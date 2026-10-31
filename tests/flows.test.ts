import { ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { C, client, db, ensureIndexes } from "@/lib/db";
import type { Actor } from "@/server/core";
import { buildQuote, cancelOrder, confirmOrder, markReady, placeOrder, processReservationExpiries, startPacking } from "@/server/orders";
import { completeRefund, reconcileCod, submitUpiReference, verifyUpiPayment } from "@/server/payments";
import { createBatch, markDelivered, partnerOrder, pickUpBatch } from "@/server/delivery";
import { partnerBatches, redeemInvite } from "@/server/delivery-access";
import { receiveStock } from "@/server/inventory";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";

const admin: Actor = { id: "admin1", role: "admin", name: "Admin" };
let n = 0;

async function customer() {
  const id = new ObjectId();
  const addr = await C.addresses.insertOne({
    _id: new ObjectId(),
    userId: id.toHexString(),
    label: "Home",
    isDefault: true,
    name: "Test",
    phone: "+919800000000",
    flat: "1",
    building: "Sadhana Society",
    street: "Hadapsar",
    pincode: "411028",
    city: "Pune",
    createdAt: new Date(),
  });
  return { user: { id: id.toHexString(), name: "Customer " + ++n }, actor: { id: id.toHexString(), role: "customer", name: "Customer" } as Actor, addressId: addr.insertedId.toHexString() };
}

async function product(stock: number, pricePaise = 30000) {
  const now = new Date();
  const cat = await C.categories.insertOne({ _id: new ObjectId(), slug: "c" + ++n, name: "Namkeen", kind: "food", visible: true, sortOrder: 0, createdAt: now, updatedAt: now });
  const brand = await C.brands.insertOne({ _id: new ObjectId(), slug: "b" + ++n, name: "Brand", visible: true, sortOrder: 0, createdAt: now, updatedAt: now });
  const p = await C.products.insertOne({
    _id: new ObjectId(), slug: "p" + ++n, name: "Sev", brandId: brand.insertedId, categoryId: cat.insertedId, kind: "food", description: "",
    images: [], labelImages: [], status: "active", featured: false, bestseller: false, tags: [], attributes: [], searchText: "sev", createdAt: now, updatedAt: now,
  });
  const v = await C.variants.insertOne({
    _id: new ObjectId(), productId: p.insertedId, sku: "SKU" + ++n, label: "250 g", mrpPaise: pricePaise, pricePaise, available: 0, reserved: 0,
    lowStockThreshold: 5, active: true, sortOrder: 0, createdAt: now, updatedAt: now,
  });
  const variantId = v.insertedId.toHexString();
  if (stock) {
    // two batches; FEFO must pick the earlier expiry first
    await receiveStock(admin, { variantId, qty: Math.ceil(stock / 2), batchNo: "LATE", expiryDate: new Date(Date.now() + 90 * 86400_000) });
    if (stock > 1) await receiveStock(admin, { variantId, qty: Math.floor(stock / 2), batchNo: "EARLY", expiryDate: new Date(Date.now() + 30 * 86400_000) });
  }
  return variantId;
}

const variant = (id: string) => C.variants.findOne({ _id: new ObjectId(id) });
const order = (id: ObjectId | string) => C.orders.findOne({ _id: new ObjectId(id) });

async function place(c: Awaited<ReturnType<typeof customer>>, variantId: string, qty: number, extra: Partial<Parameters<typeof placeOrder>[1]> = {}) {
  const q = await buildQuote([{ variantId, qty }], { userId: c.user.id, couponCode: extra.couponCode });
  return placeOrder(c.user, {
    idempotencyKey: new ObjectId().toHexString(),
    items: [{ variantId, qty }],
    addressId: c.addressId,
    paymentMethod: "upi",
    expectedTotalPaise: q.quote.totalPaise,
    ...extra,
  });
}

beforeAll(async () => {
  await db.dropDatabase();
  await ensureIndexes();
});
beforeEach(() => C.settings.replaceOne({ _id: "business" }, { ...DEFAULT_SETTINGS, upi: { vpa: "test@invalid", payeeName: "Test" } }, { upsert: true }));
afterAll(() => client.close());

describe("checkout", () => {
  it("only one of two concurrent orders gets the last unit", async () => {
    const v = await product(1);
    const [a, b] = [await customer(), await customer()];
    const results = await Promise.allSettled([place(a, v, 1), place(b, v, 1)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const after = await variant(v);
    expect(after).toMatchObject({ available: 0, reserved: 1 });
  });

  it("duplicate submissions with one idempotency key create one order", async () => {
    const v = await product(10);
    const c = await customer();
    const q = await buildQuote([{ variantId: v, qty: 2 }]);
    const input = { idempotencyKey: "dup-key", items: [{ variantId: v, qty: 2 }], addressId: c.addressId, paymentMethod: "cod" as const, expectedTotalPaise: q.quote.totalPaise };
    const [x, y, z] = await Promise.all([placeOrder(c.user, input), placeOrder(c.user, input), placeOrder(c.user, input)]);
    expect(x._id.equals(y._id) && y._id.equals(z._id)).toBe(true);
    expect(await C.orders.countDocuments({ userId: c.user.id })).toBe(1);
    expect((await variant(v))!.reserved).toBe(2);
  });

  it("rejects a stale client total, unserviceable pincodes and unconfigured UPI", async () => {
    const v = await product(5);
    const c = await customer();
    await C.settings.updateOne({ _id: "business" }, { $set: { upi: {} } });
    await expect(place(c, v, 1)).rejects.toThrow(/UPI payment isn't available/);
    await C.settings.updateOne({ _id: "business" }, { $set: { upi: { vpa: "test@invalid", payeeName: "Test" } } });
    await expect(place(c, v, 1, { expectedTotalPaise: 1 })).rejects.toThrow(/Prices changed/);
    await C.addresses.updateOne({ _id: new ObjectId(c.addressId) }, { $set: { pincode: "110001" } });
    await expect(place(c, v, 1)).rejects.toThrow(/don't deliver/);
  });

  it("coupon total usage limit holds under concurrency", async () => {
    const v = await product(10, 70000);
    await C.coupons.insertOne({
      _id: new ObjectId(), code: "ONCE", type: "fixed", value: 10000, minSubtotalPaise: 0, usageLimit: 1, usedCount: 0, perCustomerLimit: null,
      eligibleProductIds: [], eligibleCategoryIds: [], eligibleBrandIds: [], firstOrderOnly: false, showOnStorefront: false, active: true, createdAt: new Date(), updatedAt: new Date(),
    });
    const [a, b] = [await customer(), await customer()];
    const r = await Promise.allSettled([place(a, v, 1, { couponCode: "ONCE" }), place(b, v, 1, { couponCode: "ONCE" })]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await C.coupons.findOne({ code: "ONCE" }))!.usedCount).toBe(1);
    expect((await variant(v))!.reserved).toBe(1); // the failed order reserved nothing
  });
});

describe("UPI payments and reservations", () => {
  it("unpaid UPI order is cancelled when the window ends and stock returns", async () => {
    const v = await product(3);
    const c = await customer();
    const o = await place(c, v, 2);
    await C.orders.updateOne({ _id: o._id }, { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    expect(await processReservationExpiries()).toBe(1);
    expect(await order(o._id)).toMatchObject({ status: "cancelled", paymentStatus: "void", stock: "released" });
    expect(await variant(v)).toMatchObject({ available: 3, reserved: 0 });
  });

  it("customer submission never marks paid; late verification rechecks stock", async () => {
    const v = await product(1);
    const [a, b] = [await customer(), await customer()];
    const o = await place(a, v, 1);
    await submitUpiReference(a.actor, o._id.toHexString(), { reference: "412345678901" });
    expect((await order(o._id))!.paymentStatus).toBe("verification_pending");

    // hold lapses before the shop verifies, and someone else buys the unit
    await C.orders.updateOne({ _id: o._id }, { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    await processReservationExpiries();
    expect(await order(o._id)).toMatchObject({ status: "placed", stock: "released", paymentStatus: "verification_pending" });
    await place(b, v, 1, { paymentMethod: "cod" });

    await expect(verifyUpiPayment(admin, o._id.toHexString(), { amountPaise: o.pricing.totalPaise, accept: true })).rejects.toThrow(/Not enough stock/);
    const after = await order(o._id);
    expect(after).toMatchObject({ paymentStatus: "paid", status: "placed" });
    expect(after!.exception).toMatch(/no longer available/);
    expect(await C.paymentEvents.countDocuments({ orderId: o._id, type: "upi_verified", by: "admin1" })).toBe(1);
  });

  it("verify → confirm → admin cancel → refund; refund cannot complete twice", async () => {
    const v = await product(4);
    const c = await customer();
    const o = await place(c, v, 1);
    const id = o._id.toHexString();
    await expect(verifyUpiPayment(admin, id, { amountPaise: 1 })).rejects.toThrow(/must match/);
    await verifyUpiPayment(admin, id, { amountPaise: o.pricing.totalPaise, accept: true });
    expect(await order(id)).toMatchObject({ status: "confirmed", stock: "allocated", paymentStatus: "paid" });
    await expect(verifyUpiPayment(admin, id, { amountPaise: o.pricing.totalPaise })).rejects.toThrow();
    await cancelOrder(admin, id, "Customer called to cancel");
    expect(await order(id)).toMatchObject({ status: "cancelled", paymentStatus: "refund_pending", refundPendingPaise: o.pricing.totalPaise });
    expect(await variant(v)).toMatchObject({ available: 4, reserved: 0 });
    await completeRefund(admin, id, "UTR998877");
    expect(await order(id)).toMatchObject({ paymentStatus: "refunded", refundedPaise: o.pricing.totalPaise });
    await expect(completeRefund(admin, id, "UTR998877")).rejects.toThrow();
  });
});

describe("cancellation and isolation", () => {
  it("customer can cancel before packing only, and only their own order", async () => {
    const v = await product(5);
    const [a, b] = [await customer(), await customer()];
    const o1 = await place(a, v, 1, { paymentMethod: "cod" });
    await expect(cancelOrder(b.actor, o1._id.toHexString(), "not mine")).rejects.toThrow(/not found/i);
    await expect(submitUpiReference(b.actor, o1._id.toHexString(), { reference: "123456789012" })).rejects.toThrow(/not found/i);
    await cancelOrder(a.actor, o1._id.toHexString(), "changed my mind");
    expect(await order(o1._id)).toMatchObject({ status: "cancelled", paymentStatus: "void" });

    const o2 = await place(a, v, 1, { paymentMethod: "cod" });
    await confirmOrder(admin, o2._id.toHexString());
    await startPacking(admin, o2._id.toHexString());
    await expect(cancelOrder(a.actor, o2._id.toHexString(), "too late")).rejects.toThrow(/support request/);
    expect(await variant(v)).toMatchObject({ available: 4, reserved: 1 });
  });
});

describe("COD, dispatch and delivery partners", () => {
  it("FEFO deduction once, collection separate from reconciliation, partner scope", async () => {
    const v = await product(4);
    const c = await customer();
    const o = await place(c, v, 3, { paymentMethod: "cod" });
    const other = await place(c, v, 1, { paymentMethod: "cod" });
    const id = o._id.toHexString();
    await confirmOrder(admin, id);
    await startPacking(admin, id);
    await markReady(admin, id);
    await expect(markReady(admin, id)).rejects.toThrow(); // no double deduction
    const ready = await order(id);
    expect(ready!.items[0].batches![0]).toMatchObject({ batchNo: "EARLY", qty: 2 });
    expect(await variant(v)).toMatchObject({ available: 0, reserved: 1 });

    const partner = await C.users.insertOne({ _id: new ObjectId(), name: "Ravi", email: "r@x.invalid", phoneNumber: "+919811111111", role: "delivery", partnerType: "permanent", createdAt: new Date() });
    const p = { id: partner.insertedId.toHexString(), role: "delivery", partnerType: "permanent", name: "Ravi" };
    const { batch } = await createBatch(admin, { orderIds: [id], partner: { type: "permanent", userId: p.id } });
    await expect(partnerOrder(p, other._id.toHexString())).rejects.toThrow(/not found/i);
    await pickUpBatch(p, batch._id.toHexString());
    const pa: Actor = { id: p.id, role: "delivery", name: "Ravi" };
    await expect(markDelivered(pa, p, id, { confirm: true })).rejects.toThrow(/Record the cash/);
    await markDelivered(pa, p, id, { confirm: true, cod: { method: "cash", amountPaise: o.pricing.totalPaise } });
    const done = await order(id);
    expect(done).toMatchObject({ status: "delivered", paymentStatus: "collection_recorded" });
    expect(done!.cod!.reconciledAt).toBeUndefined();
    expect((await C.deliveryBatches.findOne({ _id: batch._id }))!.status).toBe("completed");

    expect(await reconcileCod(admin, [id])).toBe(1);
    expect(await reconcileCod(admin, [id])).toBe(0);
    const settled = await order(id);
    expect(settled!.paymentStatus).toBe("paid");
    expect(settled!.cod!.reconciledBy).toBe("admin1");
  });

  it("temporary invite is single-use and access ends with the batch", async () => {
    const v = await product(2);
    const c = await customer();
    const o = await place(c, v, 1, { paymentMethod: "cod" });
    const id = o._id.toHexString();
    await confirmOrder(admin, id);
    await startPacking(admin, id);
    await markReady(admin, id);
    const { token, batch } = await createBatch(admin, { orderIds: [id], partner: { type: "temporary", name: "Temp", phone: "9822222222", accessHours: 4 } });
    expect(token).toBeTruthy();
    expect(await C.invites.countDocuments({ tokenHash: token })).toBe(0); // only the hash is stored

    const redemptions = await Promise.all([redeemInvite(token!), redeemInvite(token!), redeemInvite(token!)]);
    expect(redemptions.filter(Boolean)).toHaveLength(1);
    expect(await redeemInvite(token!)).toBeNull();

    const tmp = await C.users.findOne({ phoneNumber: "+919822222222" });
    const u = { id: tmp!._id.toHexString(), role: "delivery", partnerType: "temporary", activeBatchId: tmp!.activeBatchId, accessExpiresAt: tmp!.accessExpiresAt, name: "Temp" };
    expect(await partnerBatches(u)).toHaveLength(1);
    expect(await partnerBatches({ ...u, accessExpiresAt: new Date(Date.now() - 1) })).toBeNull();

    await pickUpBatch(u, batch._id.toHexString());
    await markDelivered({ id: u.id, role: "delivery" }, u, id, { confirm: true, cod: { method: "upi", amountPaise: o.pricing.totalPaise, reference: "UPI1" } });
    const fresh = await C.users.findOne({ _id: tmp!._id });
    expect(await partnerBatches({ ...u, activeBatchId: fresh!.activeBatchId, accessExpiresAt: fresh!.accessExpiresAt })).toBeNull();
  });
});
