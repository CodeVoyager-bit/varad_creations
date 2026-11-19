import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { C, client, db, ensureIndexes } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
import { renderPolicy } from "@/lib/policy-render";
import type { Actor } from "@/server/core";
import { expireBatches, moveBatch, receiveStock } from "@/server/inventory";
import { buildQuote, cancelOrder, confirmOrder, decideSubstitution, placeOrder, proposeSubstitution, reorderItems } from "@/server/orders";
import { verifyUpiPayment } from "@/server/payments";
import { cloudinarySignature, readPrivateFile, savePrivateFile, signFileUrl, verifyFileSig } from "@/server/storage";
import imageLoader from "@/lib/image-loader";
import { orderUpdateMessages } from "@/lib/order-messages";
import { markRestockNotified, requestRestock, restockWaitlist } from "@/server/restock";

const admin: Actor = { id: "admin1", role: "admin", name: "Admin" };
let n = 0;

async function setup(stock: number, price = 30000) {
  const now = new Date();
  const userId = new ObjectId().toHexString();
  const addr = await C.addresses.insertOne({ _id: new ObjectId(), userId, label: "Home", isDefault: true, name: "T", phone: "+919800000000", flat: "1", building: "B", street: "S", pincode: "411028", city: "Pune", createdAt: now });
  const cat = await C.categories.insertOne({ _id: new ObjectId(), slug: "mc" + ++n, name: "C", kind: "food", visible: true, sortOrder: 0, createdAt: now, updatedAt: now });
  const brand = await C.brands.insertOne({ _id: new ObjectId(), slug: "mb" + ++n, name: "B", visible: true, sortOrder: 0, createdAt: now, updatedAt: now });
  const p = await C.products.insertOne({ _id: new ObjectId(), slug: "mp" + ++n, name: "P", brandId: brand.insertedId, categoryId: cat.insertedId, kind: "food", description: "", images: [], labelImages: [], status: "active", featured: false, bestseller: false, tags: [], attributes: [], searchText: "p", createdAt: now, updatedAt: now });
  const mk = async (pricePaise: number) => {
    const v = await C.variants.insertOne({ _id: new ObjectId(), productId: p.insertedId, sku: "M" + ++n, label: "x", mrpPaise: pricePaise, pricePaise, available: 0, reserved: 0, lowStockThreshold: 1, active: true, sortOrder: 0, createdAt: now, updatedAt: now });
    await receiveStock(admin, { variantId: v.insertedId.toHexString(), qty: stock, batchNo: "B" + n, expiryDate: new Date(Date.now() + 60 * 86400_000) });
    return v.insertedId.toHexString();
  };
  return { user: { id: userId, name: "T" }, actor: { id: userId, role: "customer", name: "T" } as Actor, addressId: addr.insertedId.toHexString(), mk, price };
}

async function order(s: Awaited<ReturnType<typeof setup>>, items: { variantId: string; qty: number }[], extra: Record<string, unknown> = {}) {
  const q = await buildQuote(items, { userId: s.user.id, couponCode: extra.couponCode as string });
  return placeOrder(s.user, { idempotencyKey: new ObjectId().toHexString(), items, addressId: s.addressId, paymentMethod: "upi", expectedTotalPaise: q.quote.totalPaise, ...extra });
}

beforeAll(async () => {
  await db.dropDatabase();
  await ensureIndexes();
  await C.settings.insertOne({ ...DEFAULT_SETTINGS, upi: { vpa: "t@invalid", payeeName: "T" } });
});
afterAll(() => client.close());

describe("substitution", () => {
  it("needs customer approval; approval swaps stock and refunds the difference", async () => {
    const s = await setup(5);
    const big = await s.mk(40000);
    const small = await s.mk(25000);
    const o = await order(s, [{ variantId: big, qty: 2 }]); // ₹800, free delivery
    const id = o._id.toHexString();
    await verifyUpiPayment(admin, id, { amountPaise: o.pricing.totalPaise, accept: true });
    await proposeSubstitution(admin, id, [{ index: 0, variantId: small, qty: 2 }], "500 g out, 2 × 250 g instead");
    // nothing changes until the customer decides
    expect((await C.orders.findOne({ _id: o._id }))!.items[0].variantId.toHexString()).toBe(big);
    await expect(decideSubstitution({ ...s.actor, id: "someone-else" }, id, true)).rejects.toThrow(/not found/i);
    await decideSubstitution(s.actor, id, true);
    const after = await C.orders.findOne({ _id: o._id });
    expect(after!.items[0].variantId.toHexString()).toBe(small);
    expect(after!.pricing.totalPaise).toBe(50000 + 5000); // ₹500 + ₹50 delivery (below ₹600)
    expect(after!.paymentStatus).toBe("refund_pending");
    expect(after!.refundPendingPaise).toBe(80000 - 55000);
    expect(await C.variants.findOne({ _id: new ObjectId(big) })).toMatchObject({ available: 5, reserved: 0 });
    expect(await C.variants.findOne({ _id: new ObjectId(small) })).toMatchObject({ available: 3, reserved: 2 });
  });
});

describe("order again", () => {
  it("uses today's price, caps at stock, skips what's gone, and only for the owner", async () => {
    const s = await setup(10);
    const a = await s.mk(30000);
    const b = await s.mk(20000);
    const o = await order(s, [
      { variantId: a, qty: 3 },
      { variantId: b, qty: 1 },
    ]);
    const id = o._id.toHexString();
    await cancelOrder(s.actor, id, "changed my mind");
    await C.variants.updateOne({ _id: new ObjectId(a) }, { $set: { pricePaise: 28000, available: 2 } });
    await C.variants.updateOne({ _id: new ObjectId(b) }, { $set: { active: false } });
    const r = await reorderItems(s.user.id, id);
    expect(r.unavailable).toBe(1);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ variantId: a, qty: 2, pricePaise: 28000 });
    await expect(reorderItems("someone-else", id)).rejects.toThrow(/not found/i);
  });
});

describe("notify me when it's back", () => {
  it("only for out-of-stock packs; one open request per customer; re-opens after notifying", async () => {
    const s = await setup(1);
    const v = await s.mk(10000);
    await C.variants.updateOne({ _id: new ObjectId(v) }, { $set: { available: 0 } }); // sold out
    const uid = new ObjectId();
    await C.users.insertOne({ _id: uid, name: "Asha Patil", email: `${uid}@t.invalid`, phoneNumber: "+919800000001", role: "customer", createdAt: new Date() });
    await requestRestock(uid.toHexString(), v);
    await requestRestock(uid.toHexString(), v); // twice: still one request
    let list = await restockWaitlist();
    const mine = list.find((w) => w.variantId === v)!;
    expect(mine.requests).toHaveLength(1);
    expect(mine.requests[0]).toMatchObject({ name: "Asha Patil", phone: "+919800000001" });
    expect(await markRestockNotified(admin, v)).toBe(1);
    expect((await restockWaitlist()).some((w) => w.variantId === v)).toBe(false);
    await requestRestock(uid.toHexString(), v);
    list = await restockWaitlist();
    expect(list.find((w) => w.variantId === v)?.requests).toHaveLength(1);
    // in stock again: no request needed
    await receiveStock(admin, { variantId: v, qty: 3, batchNo: "R" + ++n, expiryDate: new Date(Date.now() + 60 * 86400_000) });
    await expect(requestRestock(uid.toHexString(), v)).rejects.toThrow(/in stock/i);
  });
});

describe("WhatsApp order updates", () => {
  const base = { number: "1042", paymentMethod: "upi" as const, paymentStatus: "awaiting_payment" as const, amountReceivedPaise: 0, address: { name: "Asha Patil" }, pricing: { totalPaise: 65000 } };
  it("matches the order's stage", () => {
    const placed = orderUpdateMessages({ ...base, status: "placed" }, "Varad Creation", "https://x/orders/1");
    expect(placed.map((m) => m.label)).toEqual(["Payment reminder", "General"]);
    expect(placed[0].text).toContain("Hi Asha");
    expect(placed[0].text).toContain("₹650");
    const out = orderUpdateMessages({ ...base, paymentMethod: "cod", paymentStatus: "cod_pending" as never, status: "out_for_delivery" }, "Varad Creation", "l");
    expect(out[0].text).toMatch(/out for delivery today\. Please keep ₹650 ready\./);
  });
});

describe("coupons on cancellation", () => {
  it("cancelling releases the coupon use", async () => {
    const s = await setup(5, 70000);
    const v = await s.mk(70000);
    await C.coupons.insertOne({
      _id: new ObjectId(), code: "ONEUSE", type: "fixed", value: 5000, minSubtotalPaise: 0, usageLimit: 1, usedCount: 0, perCustomerLimit: 1,
      eligibleProductIds: [], eligibleCategoryIds: [], eligibleBrandIds: [], firstOrderOnly: false, showOnStorefront: false, active: true, createdAt: new Date(), updatedAt: new Date(),
    });
    const o = await order(s, [{ variantId: v, qty: 1 }], { couponCode: "ONEUSE", paymentMethod: "cod" });
    expect(o.pricing.discountPaise).toBe(5000);
    await expect(order(s, [{ variantId: v, qty: 1 }], { couponCode: "ONEUSE", paymentMethod: "cod" })).rejects.toThrow();
    await cancelOrder(s.actor, o._id.toHexString(), "test");
    expect((await C.coupons.findOne({ code: "ONEUSE" }))!.usedCount).toBe(0);
    const again = await order(s, [{ variantId: v, qty: 1 }], { couponCode: "ONEUSE", paymentMethod: "cod" });
    expect(again.pricing.discountPaise).toBe(5000);
    await confirmOrder(admin, again._id.toHexString());
  });
});

describe("expiry and segregation", () => {
  it("expired sellable batches are segregated; reserved units raise an alert", async () => {
    const s = await setup(4);
    const v = await s.mk(10000);
    const batch = await C.batches.findOne({ variantId: new ObjectId(v), status: "sellable" });
    await order(s, [{ variantId: v, qty: 1 }], { paymentMethod: "cod" });
    await C.batches.updateOne({ _id: batch!._id }, { $set: { expiryDate: new Date(Date.now() - 86400_000) } });
    expect(await expireBatches()).toBeGreaterThan(0);
    expect(await C.variants.findOne({ _id: new ObjectId(v) })).toMatchObject({ available: 0, reserved: 1 });
    expect(await C.batches.findOne({ variantId: new ObjectId(v), status: "expired" })).toMatchObject({ qty: 3 });
    expect(await C.alerts.countDocuments({ kind: "expired_reserved", ref: batch!._id.toHexString() })).toBe(1);
  });

  it("returned stock is not sellable until inspected, and expired stock can never be restocked", async () => {
    const s = await setup(2);
    const v = await s.mk(10000);
    const b = await C.batches.findOne({ variantId: new ObjectId(v), status: "sellable" });
    await moveBatch(admin, { batchId: b!._id.toHexString(), qty: 1, to: "damaged", reason: "crushed" });
    expect((await C.variants.findOne({ _id: new ObjectId(v) }))!.available).toBe(1);
    const damaged = await C.batches.findOne({ variantId: new ObjectId(v), status: "damaged" });
    await expect(moveBatch(admin, { batchId: damaged!._id.toHexString(), qty: 1, to: "sellable", reason: "oops" })).rejects.toThrow(/Cannot move/);
  });
});

describe("signed private-file links", () => {
  it("accepts a fresh signature and rejects tampering or expiry", () => {
    const id = new ObjectId().toHexString();
    const u = new URL(signFileUrl(id, 60), "http://x");
    expect(verifyFileSig(id, u.searchParams.get("exp")!, u.searchParams.get("sig")!)).toBe(true);
    expect(verifyFileSig(new ObjectId().toHexString(), u.searchParams.get("exp")!, u.searchParams.get("sig")!)).toBe(false);
    expect(verifyFileSig(id, String(Number(u.searchParams.get("exp")) + 1), u.searchParams.get("sig")!)).toBe(false);
    expect(verifyFileSig(id, "1", u.searchParams.get("sig")!)).toBe(false);
  });
});

describe("private uploads", () => {
  it("stores real images privately and rejects disguised files", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a00000000049454e44ae426082", "hex");
    const id = await savePrivateFile(new File([png], "proof.png", { type: "image/png" }), { ownerId: "u1", orderId: "o1", kind: "payment_proof" });
    const f = await readPrivateFile(id);
    expect(f).toMatchObject({ contentType: "image/png", ownerId: "u1" });
    expect(f!.buf.equals(png)).toBe(true);
    const fake = new File(["<svg onload=alert(1)>"], "x.png", { type: "image/png" });
    await expect(savePrivateFile(fake, { ownerId: "u1", orderId: "o1", kind: "payment_proof" })).rejects.toThrow(/Only JPEG, PNG or WebP/);
  });
});

describe("Cloudinary", () => {
  it("signs uploads exactly like Cloudinary's documented example", () => {
    const params = { eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: 1315060510 };
    expect(cloudinarySignature(params, "abcd")).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
    expect(cloudinarySignature({ timestamp: 1315060510 }, "abcd")).toBe("a21ad0f63beb4de2e5575204b79ab90bffb02c10");
  });
  it("asks Cloudinary for a resized, auto-format image (pack shots trimmed); leaves other sources alone", () => {
    expect(imageLoader({ src: "https://res.cloudinary.com/demo/image/upload/v1/varad/products/a.jpg", width: 384 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/e_trim:10/f_auto,q_auto,c_limit,w_384/v1/varad/products/a.jpg",
    );
    expect(imageLoader({ src: "https://res.cloudinary.com/demo/image/upload/v1/varad/banners/a.jpg", width: 384 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_384/v1/varad/banners/a.jpg",
    );
    expect(imageLoader({ src: "/uploads/products/a.jpg", width: 640 })).toBe("/uploads/products/a.jpg?w=640");
  });
});

describe("policy renderer", () => {
  it("escapes HTML, marks missing facts, only allows safe links", () => {
    const html = renderPolicy("## Hi <script>x</script>\nCall {{phone}} or {{email}}\n- [ok](/terms)\n- [bad](javascript:alert(1))", { phone: "+91 1" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("+91 1");
    expect(html).toContain("[to be added: email]");
    expect(html).toContain('<a href="/terms">ok</a>');
    expect(html).not.toContain('href="javascript');
  });
});
