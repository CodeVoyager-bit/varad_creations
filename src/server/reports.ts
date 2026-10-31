import { C } from "@/lib/db";

export function range(sp: Record<string, string | string[] | undefined>) {
  const to = sp.to ? new Date(`${sp.to}T23:59:59+05:30`) : new Date();
  const from = sp.from ? new Date(`${sp.from}T00:00:00+05:30`) : new Date(to.getTime() - 30 * 86400_000);
  return { from: isNaN(+from) ? new Date(Date.now() - 30 * 86400_000) : from, to: isNaN(+to) ? new Date() : to };
}

export async function salesReport(from: Date, to: Date) {
  const created = { createdAt: { $gte: from, $lte: to } };
  const [byStatus, totals, events, moves, top, unsettled] = await Promise.all([
    C.orders.aggregate<{ _id: string; n: number; value: number }>([{ $match: created }, { $group: { _id: "$status", n: { $sum: 1 }, value: { $sum: "$pricing.totalPaise" } } }]).toArray(),
    C.orders
      .aggregate<{ items: number; discounts: number; delivery: number; total: number; n: number }>([
        { $match: { ...created, status: { $ne: "cancelled" } } },
        { $group: { _id: null, n: { $sum: 1 }, items: { $sum: "$pricing.subtotalPaise" }, discounts: { $sum: "$pricing.discountPaise" }, delivery: { $sum: "$pricing.deliveryFeePaise" }, total: { $sum: "$pricing.totalPaise" } } },
      ])
      .toArray(),
    C.paymentEvents.aggregate<{ _id: string; n: number; amount: number }>([{ $match: { at: { $gte: from, $lte: to } } }, { $group: { _id: "$type", n: { $sum: 1 }, amount: { $sum: "$amountPaise" } } }]).toArray(),
    C.movements.aggregate<{ _id: string; qty: number }>([{ $match: { at: { $gte: from, $lte: to } } }, { $group: { _id: "$type", qty: { $sum: "$qty" } } }]).toArray(),
    C.orders
      .aggregate<{ _id: string; qty: number; value: number }>([
        { $match: { ...created, status: { $ne: "cancelled" } } },
        { $unwind: "$items" },
        { $group: { _id: { $concat: ["$items.brand", " ", "$items.name", " ", "$items.variantLabel"] }, qty: { $sum: "$items.qty" }, value: { $sum: "$items.lineTotalPaise" } } },
        { $sort: { qty: -1 } },
        { $limit: 15 },
      ])
      .toArray(),
    C.orders.aggregate<{ sum: number; n: number }>([{ $match: { "cod.recordedAt": { $exists: true }, "cod.reconciledAt": { $exists: false } } }, { $group: { _id: null, sum: { $sum: "$cod.collectedPaise" }, n: { $sum: 1 } } }]).toArray(),
  ]);
  return { byStatus, totals: totals[0], events, moves, top, unsettled: unsettled[0] };
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  // neutralise spreadsheet formulas
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n");

export async function exportCsv(type: string, from: Date, to: Date) {
  const rs = (p?: number) => (p == null ? "" : (p / 100).toFixed(2));
  if (type === "payments") {
    const ev = await C.paymentEvents.find({ at: { $gte: from, $lte: to } }).sort({ at: 1 }).toArray();
    return toCsv([["at", "order", "type", "amount_inr", "method", "reference", "by_role", "by", "note"], ...ev.map((e) => [e.at, e.orderNumber, e.type, rs(e.amountPaise), e.method, e.reference, e.byRole, e.by, e.note])]);
  }
  if (type === "stock") {
    const mv = await C.movements.find({ at: { $gte: from, $lte: to } }).sort({ at: 1 }).toArray();
    const vs = await C.variants.find({ _id: { $in: [...new Set(mv.map((m) => m.variantId.toHexString()))].map((x) => mv.find((m) => m.variantId.toHexString() === x)!.variantId) } }).toArray();
    return toCsv([["at", "sku", "pack", "type", "qty", "reason", "order_id", "by"], ...mv.map((m) => { const v = vs.find((x) => x._id.equals(m.variantId)); return [m.at, v?.sku, v?.label, m.type, m.qty, m.reason, m.orderId, m.by]; })]);
  }
  const orders = await C.orders.find({ createdAt: { $gte: from, $lte: to } }).sort({ createdAt: 1 }).toArray();
  return toCsv([
    ["created", "order", "status", "payment_method", "payment_status", "items_inr", "discount_inr", "coupon", "delivery_fee_inr", "total_inr", "received_inr", "refunded_inr", "cod_settled", "pincode"],
    ...orders.map((o) => [o.createdAt, o.number, o.status, o.paymentMethod, o.paymentStatus, rs(o.pricing.subtotalPaise), rs(o.pricing.discountPaise), o.pricing.couponCode, rs(o.pricing.deliveryFeePaise), rs(o.pricing.totalPaise), rs(o.amountReceivedPaise), rs(o.refundedPaise), o.cod ? (o.cod.reconciledAt ? "yes" : "no") : "", o.address.pincode]),
  ]);
}
