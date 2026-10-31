import { ObjectId, MongoServerError, type ClientSession } from "mongodb";
import { C, nextSeq, withTxn } from "@/lib/db";
import { canMoveOrder, CUSTOMER_CANCELLABLE, ORDER_LABEL } from "@/lib/order-rules";
import { evaluateCoupon, priceCart, type CouponRule, type QuoteLine } from "@/lib/pricing";
import type { CouponDoc, OrderDoc, OrderItem, OrderStatus, PaymentEventDoc, Pricing } from "@/lib/types";
import { addHours, addMinutes, AppError, audit, type Actor } from "./core";
import { deductForOrder, receiveReturn, releaseLines, reserveLines, StockError } from "./inventory";
import { loadSettings, serviceability } from "./settings";

export interface CartLineInput {
  variantId: string;
  qty: number;
}

export interface QuoteLineView {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  brand: string;
  variantLabel: string;
  image?: string;
  mrpPaise: number;
  unitPricePaise: number;
  qty: number;
  available: number;
  issue?: "unavailable" | "insufficient";
}

const MAX_LINES = 50;
const MAX_QTY = 24;

export const toCouponRule = (c: CouponDoc): CouponRule => ({
  ...c,
  eligibleProductIds: c.eligibleProductIds.map(String),
  eligibleCategoryIds: c.eligibleCategoryIds.map(String),
  eligibleBrandIds: c.eligibleBrandIds.map(String),
});

function mergeLines(input: CartLineInput[]) {
  const m = new Map<string, number>();
  for (const l of input.slice(0, MAX_LINES)) {
    if (!ObjectId.isValid(l.variantId)) continue;
    const q = Math.floor(Number(l.qty));
    if (q > 0) m.set(l.variantId, Math.min(MAX_QTY, (m.get(l.variantId) ?? 0) + q));
  }
  return [...m].map(([variantId, qty]) => ({ variantId, qty }));
}

/** Server-side price + availability for a cart. Lines with an issue are shown but not priced. */
export async function buildQuote(input: CartLineInput[], opts: { userId?: string; couponCode?: string; session?: ClientSession } = {}) {
  const s = opts.session;
  const settings = await loadSettings();
  const wanted = mergeLines(input);
  const variants = await C.variants.find({ _id: { $in: wanted.map((l) => new ObjectId(l.variantId)) } }, { session: s }).toArray();
  const products = await C.products.find({ _id: { $in: variants.map((v) => v.productId) } }, { session: s }).toArray();
  const brands = await C.brands.find({ _id: { $in: products.map((p) => p.brandId) } }, { session: s }).toArray();
  const cats = await C.categories.find({ _id: { $in: products.map((p) => p.categoryId) } }, { session: s }).toArray();

  const views: QuoteLineView[] = [];
  const priced: { line: QuoteLine; view: QuoteLineView }[] = [];
  for (const w of wanted) {
    const v = variants.find((x) => x._id.equals(w.variantId));
    const p = v && products.find((x) => x._id.equals(v.productId));
    const cat = p && cats.find((x) => x._id.equals(p.categoryId));
    const brand = p && brands.find((x) => x._id.equals(p.brandId));
    if (!v || !p || !cat || !brand) continue;
    const sellable = v.active && p.status === "active" && cat.visible && brand.visible;
    const view: QuoteLineView = {
      variantId: v._id.toHexString(),
      productId: p._id.toHexString(),
      slug: p.slug,
      name: p.name,
      brand: brand.name,
      variantLabel: v.label,
      image: p.images[0],
      mrpPaise: v.mrpPaise,
      unitPricePaise: v.pricePaise,
      qty: w.qty,
      available: sellable ? v.available : 0,
      issue: !sellable || v.available <= 0 ? "unavailable" : v.available < w.qty ? "insufficient" : undefined,
    };
    views.push(view);
    if (!view.issue)
      priced.push({
        view,
        line: { variantId: view.variantId, productId: view.productId, categoryId: p.categoryId.toHexString(), brandId: p.brandId.toHexString(), unitPricePaise: v.pricePaise, qty: w.qty },
      });
  }

  let couponDoc: CouponDoc | null = null;
  let couponResult;
  if (opts.couponCode?.trim()) {
    const code = opts.couponCode.trim().toUpperCase();
    couponDoc = await C.coupons.findOne({ code }, { session: s });
    if (!couponDoc) couponResult = { ok: false as const, code, reason: "This coupon code is not valid." };
    else {
      const [priorOrders, customerUses] = opts.userId
        ? await Promise.all([
            C.orders.countDocuments({ userId: opts.userId, status: { $ne: "cancelled" } }, { session: s }),
            C.couponRedemptions.countDocuments({ couponId: couponDoc._id, userId: opts.userId, status: "active" }, { session: s }),
          ])
        : [0, 0];
      couponResult = evaluateCoupon(
        priced.map((x) => x.line),
        toCouponRule(couponDoc),
        { now: new Date(), signedIn: !!opts.userId, priorOrders, customerUses },
      );
    }
  }
  const quote = priceCart(priced.map((x) => x.line), { feePaise: settings.delivery.feePaise, freeAbovePaise: settings.delivery.freeAbovePaise }, couponResult);
  return { views, priced, quote, couponDoc, settings };
}

export interface PlaceOrderInput {
  idempotencyKey: string;
  items: CartLineInput[];
  couponCode?: string;
  addressId: string;
  paymentMethod: "upi" | "cod";
  expectedTotalPaise: number;
  customerNote?: string;
}

export async function placeOrder(user: { id: string; name: string }, input: PlaceOrderInput): Promise<OrderDoc> {
  const existing = await C.orders.findOne({ userId: user.id, idempotencyKey: input.idempotencyKey });
  if (existing) return existing;
  // free stock held by lapsed reservations before checking availability (cron-independent)
  await processReservationExpiries();

  const address = ObjectId.isValid(input.addressId) ? await C.addresses.findOne({ _id: new ObjectId(input.addressId), userId: user.id }) : null;
  if (!address) throw new AppError("Please choose a delivery address.");
  const settings = await loadSettings();
  const svc = serviceability(settings, address.pincode, address);
  if (!svc.ok) throw new AppError(svc.reason);
  if (input.paymentMethod === "upi" && !(settings.upi.vpa && settings.upi.payeeName)) throw new AppError("UPI payment isn't available right now. Please choose cash on delivery.");

  try {
    return await withTxn(async (s) => {
      const { views, priced, quote, couponDoc } = await buildQuote(input.items, { userId: user.id, couponCode: input.couponCode, session: s });
      if (!priced.length) throw new AppError("Your cart is empty.");
      if (views.some((v) => v.issue)) throw new AppError("Some items are unavailable or low on stock. Please review your cart.", "cart_changed");
      if (quote.coupon && !quote.coupon.ok) throw new AppError(quote.coupon.reason, "coupon");
      if (quote.totalPaise !== input.expectedTotalPaise) throw new AppError("Prices changed since you opened checkout. Please review the updated total.", "price_changed");

      const now = new Date();
      const orderId = new ObjectId();
      if (couponDoc && quote.coupon?.ok) {
        const r = await C.coupons.updateOne(
          { _id: couponDoc._id, $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
          { $inc: { usedCount: 1 } },
          { session: s },
        );
        if (!r.modifiedCount) throw new AppError("This coupon has reached its usage limit.", "coupon");
        await C.couponRedemptions.insertOne({ couponId: couponDoc._id, userId: user.id, orderId, status: "active", createdAt: now }, { session: s });
      }
      await reserveLines(priced.map((p) => ({ variantId: new ObjectId(p.line.variantId), qty: p.line.qty })), orderId, s);

      const upi = input.paymentMethod === "upi";
      const deadline = upi ? addMinutes(now, settings.delivery.upiPaymentMinutes) : null;
      const items: OrderItem[] = priced.map(({ view }, i) => ({
        productId: new ObjectId(view.productId),
        variantId: new ObjectId(view.variantId),
        name: view.name,
        brand: view.brand,
        variantLabel: view.variantLabel,
        image: view.image,
        mrpPaise: view.mrpPaise,
        unitPricePaise: view.unitPricePaise,
        qty: view.qty,
        lineTotalPaise: view.unitPricePaise * view.qty,
        discountPaise: quote.lineDiscounts[i],
      }));
      const order: OrderDoc = {
        _id: orderId,
        number: `VC${1000 + (await nextSeq("order", s))}`,
        userId: user.id,
        idempotencyKey: input.idempotencyKey,
        items,
        pricing: {
          subtotalPaise: quote.subtotalPaise,
          discountPaise: quote.discountPaise,
          discountedSubtotalPaise: quote.discountedSubtotalPaise,
          deliveryFeePaise: quote.deliveryFeePaise,
          totalPaise: quote.totalPaise,
          ...(couponDoc && quote.coupon?.ok ? { couponCode: couponDoc.code, couponId: couponDoc._id } : {}),
        },
        address: {
          name: address.name,
          phone: address.phone,
          flat: address.flat,
          building: address.building,
          street: address.street,
          landmark: address.landmark,
          pincode: address.pincode,
          city: address.city,
          lat: address.lat,
          lng: address.lng,
          instructions: address.instructions,
        },
        paymentMethod: input.paymentMethod,
        status: "placed",
        paymentStatus: upi ? "awaiting_payment" : "cod_due",
        stock: "reserved",
        reservationExpiresAt: upi ? deadline : addHours(now, settings.delivery.codAcceptHours),
        paymentDeadline: deadline,
        amountReceivedPaise: 0,
        refundedPaise: 0,
        refundPendingPaise: 0,
        delivery: { attempts: [] },
        customerNote: input.customerNote?.slice(0, 300) || undefined,
        adminNotes: [],
        timeline: [{ at: now, event: "Order placed", by: user.name }],
        createdAt: now,
        updatedAt: now,
      };
      await C.orders.insertOne(order, { session: s });
      return order;
    });
  } catch (e) {
    // a concurrent duplicate submission with the same key won the race
    if (e instanceof MongoServerError && e.code === 11000) {
      const o = await C.orders.findOne({ userId: user.id, idempotencyKey: input.idempotencyKey });
      if (o) return o;
    }
    throw e;
  }
}

// ---------- lifecycle ----------

const by = (a: Actor) => a.name ?? a.role;

async function setStatus(o: OrderDoc, to: OrderStatus, actor: Actor, s: ClientSession, set: Record<string, unknown> = {}, note?: string) {
  if (!canMoveOrder(o.status, to)) throw new AppError(`Cannot move an order from "${ORDER_LABEL[o.status]}" to "${ORDER_LABEL[to]}".`);
  const now = new Date();
  const r = await C.orders.updateOne(
    { _id: o._id, status: o.status },
    { $set: { status: to, updatedAt: now, ...set }, $push: { timeline: { at: now, event: ORDER_LABEL[to], by: by(actor), note } } },
    { session: s },
  );
  if (!r.modifiedCount) throw new AppError("This order was just updated elsewhere. Refresh and try again.", "conflict");
}

async function mustFind(id: string, s?: ClientSession, filter: Record<string, unknown> = {}) {
  const o = ObjectId.isValid(id) ? await C.orders.findOne({ _id: new ObjectId(id), ...filter }, { session: s }) : null;
  if (!o) throw new AppError("Order not found.", "not_found");
  return o;
}

export async function releaseCoupon(o: OrderDoc, s: ClientSession) {
  if (!o.pricing.couponId) return;
  const r = await C.couponRedemptions.updateOne({ orderId: o._id, status: "active" }, { $set: { status: "released" } }, { session: s });
  if (r.modifiedCount) await C.coupons.updateOne({ _id: o.pricing.couponId }, { $inc: { usedCount: -1 } }, { session: s });
}

export const ledger = (o: OrderDoc, e: Omit<PaymentEventDoc, "orderId" | "orderNumber" | "at">, s?: ClientSession) =>
  C.paymentEvents.insertOne({ orderId: o._id, orderNumber: o.number, at: new Date(), ...e }, { session: s });

/**
 * Releases a reservation whose deadline passed. An unpaid UPI order with no reference
 * submitted is cancelled; anything else keeps its status with stock "released" so a
 * later confirmation re-checks stock.
 */
export async function lapseReservation(orderId: ObjectId, now = new Date()) {
  return withTxn(async (s) => {
    const o = await C.orders.findOne({ _id: orderId, stock: "reserved", reservationExpiresAt: { $lt: now } }, { session: s });
    if (!o) return false;
    await releaseLines(o.items, o._id, s, "reservation expired");
    const cancel = o.paymentMethod === "upi" && o.paymentStatus === "awaiting_payment" && o.status === "placed";
    const set = cancel
      ? { status: "cancelled" as const, paymentStatus: "void" as const, cancelledBy: "system" as const, cancelReason: "Payment was not received within the payment window." }
      : {};
    await C.orders.updateOne(
      { _id: o._id },
      {
        $set: { stock: "released", reservationExpiresAt: null, updatedAt: now, ...set },
        $push: { timeline: { at: now, event: cancel ? "Cancelled — payment window ended" : "Stock hold expired", by: "System" } },
      },
      { session: s },
    );
    if (cancel) await releaseCoupon(o, s);
    return true;
  });
}

export async function processReservationExpiries(now = new Date()) {
  const due = await C.orders.find({ stock: "reserved", reservationExpiresAt: { $lt: now } }, { projection: { _id: 1 } }).limit(500).toArray();
  let n = 0;
  for (const d of due) if (await lapseReservation(d._id, now)) n++;
  return n;
}

/** Request-time check so correctness never depends on the cron having run. */
export async function lapseIfDue(id: string) {
  if (ObjectId.isValid(id)) await lapseReservation(new ObjectId(id));
}

export async function confirmOrder(actor: Actor, id: string) {
  await lapseIfDue(id);
  const settings = await loadSettings();
  try {
    await withTxn(async (s) => {
      const o = await mustFind(id, s);
      if (o.status !== "placed") throw new AppError("Only newly placed orders can be accepted.");
      if (o.paymentMethod === "upi" && o.paymentStatus !== "paid") throw new AppError("Verify the UPI payment before accepting this order.");
      if (o.paymentMethod === "cod" && o.paymentStatus !== "cod_due") throw new AppError("This COD order cannot be accepted in its current payment state.");
      if (o.stock === "released") await reserveLines(o.items, o._id, s);
      const now = new Date();
      await setStatus(o, "confirmed", actor, s, {
        stock: "allocated",
        reservationExpiresAt: null,
        confirmedAt: now,
        expectedBy: addHours(now, settings.delivery.windowHours),
        exception: null,
      });
    });
  } catch (e) {
    if (e instanceof StockError) {
      await C.orders.updateOne(
        { _id: new ObjectId(id) },
        { $set: { exception: "Stock is no longer available for this order. Propose a substitution (customer must approve) or cancel and refund." } },
      );
      throw new AppError("Not enough stock to confirm this order. It has been flagged for review.");
    }
    throw e;
  }
  await audit(actor, "order.confirm", "order", id);
}

export async function startPacking(actor: Actor, id: string) {
  await withTxn(async (s) => setStatus(await mustFind(id, s), "packing", actor, s));
  await audit(actor, "order.packing", "order", id);
}

export async function markReady(actor: Actor, id: string) {
  await withTxn(async (s) => {
    const o = await mustFind(id, s);
    if (o.substitution?.status === "pending") throw new AppError("Wait for the customer to respond to the substitution first.");
    if (o.stock !== "allocated") throw new AppError("Stock for this order is not allocated.");
    const items = await deductForOrder(o, s, actor.id);
    await setStatus(o, "ready_for_dispatch", actor, s, { items, stock: "deducted" });
  });
  await audit(actor, "order.ready", "order", id);
}

export async function cancelOrder(actor: Actor, id: string, reason: string) {
  if (!reason.trim()) throw new AppError("Please give a reason for cancelling.");
  if (actor.role === "customer") await lapseIfDue(id);
  await withTxn(async (s) => {
    const o = await mustFind(id, s, actor.role === "customer" ? { userId: actor.id } : {});
    if (actor.role === "customer" && !CUSTOMER_CANCELLABLE.includes(o.status))
      throw new AppError("Packing has already started, so this order can't be cancelled here. Please raise a support request.");

    if (o.stock === "reserved" || o.stock === "allocated") await releaseLines(o.items, o._id, s, `cancelled: ${reason}`);
    if (o.stock === "deducted") await receiveReturn(o, s, actor.id, "cancelled after dispatch preparation");
    await releaseCoupon(o, s);

    const set: Record<string, unknown> = {
      stock: o.stock === "deducted" ? "deducted" : "released",
      reservationExpiresAt: null,
      cancelReason: reason.slice(0, 300),
      cancelledBy: actor.role === "customer" ? "customer" : actor.role === "system" ? "system" : "admin",
    };
    const refundable = o.amountReceivedPaise - o.refundedPaise - o.refundPendingPaise;
    if (o.paymentStatus === "awaiting_payment" || o.paymentStatus === "cod_due") {
      set.paymentStatus = "void";
      await ledger(o, { type: "payment_voided", amountPaise: 0, by: actor.id, byRole: actor.role, note: "Order cancelled before payment" }, s);
    } else if (refundable > 0 && ["paid", "collection_recorded", "partially_refunded"].includes(o.paymentStatus)) {
      set.paymentStatus = "refund_pending";
      set.refundPendingPaise = o.refundPendingPaise + refundable;
      await ledger(o, { type: "refund_initiated", amountPaise: refundable, by: actor.id, byRole: actor.role, note: `Order cancelled: ${reason}` }, s);
    } else if (o.paymentStatus === "verification_pending") {
      set.exception = "Cancelled while UPI verification was pending. Check the bank account: if the money arrived, mark it received (a refund will be opened); otherwise mark no payment.";
    }
    await setStatus(o, "cancelled", actor, s, set, reason);
  });
  await audit(actor, "order.cancel", "order", id, reason);
}

/** Admin: delivery failed -> reschedule for a new batch. */
export async function rescheduleOrder(actor: Actor, id: string, date: Date, note?: string) {
  await withTxn(async (s) => {
    const o = await mustFind(id, s);
    await setStatus(o, "rescheduled", actor, s, { "delivery.rescheduledFor": date, "delivery.batchId": null, "delivery.partnerId": null }, note);
  });
  await audit(actor, "order.reschedule", "order", id, date.toISOString());
}

export async function addAdminNote(actor: Actor, id: string, text: string) {
  if (!text.trim()) return;
  await C.orders.updateOne({ _id: new ObjectId(id) }, { $push: { adminNotes: { at: new Date(), by: by(actor), text: text.slice(0, 1000) } } });
}

// ---------- substitutions (customer approval required) ----------

export async function proposeSubstitution(actor: Actor, id: string, changes: { index: number; variantId?: string; qty: number }[], note?: string) {
  const o = await mustFind(id);
  if (!["confirmed", "packing"].includes(o.status)) throw new AppError("Substitutions can be proposed only for confirmed or packing orders.");
  if (o.substitution?.status === "pending") throw new AppError("A substitution is already waiting for the customer.");
  const items = o.items.map((i) => ({ ...i }));
  for (const c of changes) {
    const cur = items[c.index];
    if (!cur) throw new AppError("Invalid item.");
    if (c.variantId && c.variantId !== cur.variantId.toHexString()) {
      const v = await C.variants.findOne({ _id: new ObjectId(c.variantId), active: true });
      const p = v && (await C.products.findOne({ _id: v.productId }));
      const b = p && (await C.brands.findOne({ _id: p.brandId }));
      if (!v || !p || !b) throw new AppError("Replacement product not found.");
      items[c.index] = { productId: p._id, variantId: v._id, name: p.name, brand: b.name, variantLabel: v.label, image: p.images[0], mrpPaise: v.mrpPaise, unitPricePaise: v.pricePaise, qty: c.qty, lineTotalPaise: 0, discountPaise: 0 };
    } else items[c.index] = { ...cur, qty: c.qty };
  }
  const kept = items.filter((i) => i.qty > 0);
  if (!kept.length) throw new AppError("A substitution cannot remove every item. Cancel the order instead.");

  const settings = await loadSettings();
  const lines: QuoteLine[] = [];
  for (const i of kept) {
    const p = await C.products.findOne({ _id: i.productId });
    lines.push({ variantId: i.variantId.toHexString(), productId: i.productId.toHexString(), categoryId: String(p?.categoryId), brandId: String(p?.brandId), unitPricePaise: i.unitPricePaise, qty: i.qty });
  }
  const coupon = o.pricing.couponId ? await C.coupons.findOne({ _id: o.pricing.couponId }) : null;
  // the coupon was already redeemed for this order, so only its amount rules are re-applied
  const cr = coupon
    ? evaluateCoupon(lines, { ...toCouponRule(coupon), active: true, startsAt: null, endsAt: null, usageLimit: null, perCustomerLimit: null, firstOrderOnly: false }, { now: new Date(), signedIn: true, priorOrders: 0, customerUses: 0 })
    : undefined;
  const q = priceCart(lines, { feePaise: settings.delivery.feePaise, freeAbovePaise: settings.delivery.freeAbovePaise }, cr);
  const paidNet = o.amountReceivedPaise - o.refundedPaise - o.refundPendingPaise;
  if (o.paymentMethod === "upi" && q.totalPaise > paidNet) throw new AppError("This substitution costs more than the customer paid. Call the customer, or cancel and refund instead.");

  const pricing: Pricing = {
    subtotalPaise: q.subtotalPaise,
    discountPaise: q.discountPaise,
    discountedSubtotalPaise: q.discountedSubtotalPaise,
    deliveryFeePaise: q.deliveryFeePaise,
    totalPaise: q.totalPaise,
    ...(cr?.ok ? { couponCode: o.pricing.couponCode, couponId: o.pricing.couponId } : {}),
  };
  const newItems = kept.map((i, k) => ({ ...i, lineTotalPaise: i.unitPricePaise * i.qty, discountPaise: q.lineDiscounts[k] }));
  const now = new Date();
  await C.orders.updateOne(
    { _id: o._id, status: o.status },
    {
      $set: { substitution: { status: "pending", items: newItems, pricing, note, proposedBy: by(actor), proposedAt: now }, updatedAt: now },
      $push: { timeline: { at: now, event: "Substitution proposed — waiting for customer approval", by: by(actor), note } },
    },
  );
  await audit(actor, "order.substitution.propose", "order", id, note);
}

export async function decideSubstitution(actor: Actor, id: string, approve: boolean) {
  await withTxn(async (s) => {
    const o = await mustFind(id, s, { userId: actor.id, "substitution.status": "pending" });
    const sub = o.substitution!;
    const now = new Date();
    if (!approve) {
      await C.orders.updateOne(
        { _id: o._id },
        { $set: { "substitution.status": "rejected", "substitution.decidedAt": now }, $push: { timeline: { at: now, event: "Customer declined the substitution", by: by(actor) } } },
        { session: s },
      );
      return;
    }
    const qty = (items: OrderItem[]) => items.reduce((m, i) => m.set(i.variantId.toHexString(), (m.get(i.variantId.toHexString()) ?? 0) + i.qty), new Map<string, number>());
    const before = qty(o.items);
    const after = qty(sub.items);
    const more: { variantId: ObjectId; qty: number }[] = [];
    const less: { variantId: ObjectId; qty: number }[] = [];
    for (const v of new Set([...before.keys(), ...after.keys()])) {
      const d = (after.get(v) ?? 0) - (before.get(v) ?? 0);
      if (d > 0) more.push({ variantId: new ObjectId(v), qty: d });
      if (d < 0) less.push({ variantId: new ObjectId(v), qty: -d });
    }
    await releaseLines(less, o._id, s, "substitution");
    await reserveLines(more, o._id, s);

    const set: Record<string, unknown> = { items: sub.items, pricing: sub.pricing, "substitution.status": "approved", "substitution.decidedAt": now, exception: null, updatedAt: now };
    const excess = o.amountReceivedPaise - o.refundedPaise - o.refundPendingPaise - sub.pricing.totalPaise;
    if (o.paymentMethod === "upi" && excess > 0) {
      set.paymentStatus = "refund_pending";
      set.refundPendingPaise = o.refundPendingPaise + excess;
      await ledger(o, { type: "refund_initiated", amountPaise: excess, by: actor.id, byRole: "customer", note: "Approved substitution reduced the total" }, s);
    }
    if (!sub.pricing.couponId) await releaseCoupon(o, s);
    await C.orders.updateOne({ _id: o._id }, { $set: set, $push: { timeline: { at: now, event: "Customer approved the substitution", by: by(actor) } } }, { session: s });
  });
}
