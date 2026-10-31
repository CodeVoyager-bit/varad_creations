import { ObjectId, type ClientSession } from "mongodb";
import { C, withTxn } from "@/lib/db";
import type { BatchStatus, OrderDoc, OrderItem, StockBatchDoc } from "@/lib/types";
import { AppError, audit, raiseAlert, type Actor } from "./core";

/**
 * Stock model per variant:
 *   available  – can be sold now
 *   reserved   – held for open orders (reservation with deadline, or allocation once confirmed)
 *   on hand    – available + reserved = Σ qty of sellable batches
 * Units leave the shelf exactly once, when an order is committed at "ready for dispatch".
 */

export class StockError extends AppError {
  constructor(public variantId: string) {
    super("Some items just went out of stock. Please review your cart.", "out_of_stock");
  }
}

type Line = { variantId: ObjectId; qty: number };

async function move(type: import("@/lib/types").MovementType, lines: Line[], s?: ClientSession, extra: { orderId?: ObjectId; reason?: string; by?: string; batchId?: ObjectId } = {}) {
  if (!lines.length) return;
  await C.movements.insertMany(
    lines.map((l) => ({ variantId: l.variantId, type, qty: l.qty, at: new Date(), ...extra })),
    { session: s },
  );
}

/** available -> reserved, atomically per variant. Throws StockError on the first shortfall. */
export async function reserveLines(lines: Line[], orderId: ObjectId, s: ClientSession) {
  for (const l of lines) {
    const r = await C.variants.updateOne(
      { _id: l.variantId, active: true, available: { $gte: l.qty } },
      { $inc: { available: -l.qty, reserved: l.qty } },
      { session: s },
    );
    if (r.modifiedCount !== 1) throw new StockError(l.variantId.toHexString());
  }
  await move("reserve", lines, s, { orderId });
}

/** reserved -> available */
export async function releaseLines(lines: Line[], orderId: ObjectId, s: ClientSession, reason: string) {
  for (const l of lines) {
    await C.variants.updateOne({ _id: l.variantId }, { $inc: { available: l.qty, reserved: -l.qty } }, { session: s });
  }
  await move("release", lines, s, { orderId, reason });
}

const sortFefo = (a: StockBatchDoc, b: StockBatchDoc) =>
  (a.expiryDate?.getTime() ?? Infinity) - (b.expiryDate?.getTime() ?? Infinity) || a.receivedAt.getTime() - b.receivedAt.getTime();

/** Takes qty from sellable batches, earliest expiry first. Returns what it took. */
async function takeFefo(variantId: ObjectId, qty: number, s: ClientSession) {
  const batches = (await C.batches.find({ variantId, status: "sellable", qty: { $gt: 0 } }, { session: s }).toArray()).sort(sortFefo);
  const taken: { batchId: ObjectId; batchNo: string; expiryDate?: Date; qty: number }[] = [];
  let left = qty;
  for (const b of batches) {
    if (!left) break;
    const n = Math.min(left, b.qty);
    await C.batches.updateOne({ _id: b._id, qty: { $gte: n } }, { $inc: { qty: -n } }, { session: s });
    taken.push({ batchId: b._id, batchNo: b.batchNo, expiryDate: b.expiryDate, qty: n });
    left -= n;
  }
  return { taken, short: left };
}

/** Allocated stock physically leaves: reserved decreases, batches decrease earliest-expiry first. */
export async function deductForOrder(order: OrderDoc, s: ClientSession, by: string): Promise<OrderItem[]> {
  const items: OrderItem[] = [];
  for (const it of order.items) {
    const r = await C.variants.updateOne({ _id: it.variantId, reserved: { $gte: it.qty } }, { $inc: { reserved: -it.qty } }, { session: s });
    if (r.modifiedCount !== 1) throw new AppError(`Stock records for ${it.name} (${it.variantLabel}) don't match. Check inventory before dispatch.`);
    const { taken, short } = await takeFefo(it.variantId, it.qty, s);
    if (short) await raiseAlert("batch_shortfall", `${order.number}: ${short} unit(s) of ${it.name} ${it.variantLabel} had no batch record.`, it.variantId.toHexString());
    items.push({ ...it, batches: taken.map(({ batchNo, expiryDate, qty }) => ({ batchNo, expiryDate, qty })) });
  }
  await move("deduct", order.items, s, { orderId: order._id, by });
  return items;
}

/** Goods that came back (failed delivery, return). Kept apart until an admin inspects and restocks them. */
export async function receiveReturn(order: OrderDoc, s: ClientSession, by: string, reason: string) {
  for (const it of order.items) {
    await C.batches.insertOne(
      {
        _id: new ObjectId(),
        variantId: it.variantId,
        batchNo: it.batches?.[0]?.batchNo ?? `RET-${order.number}`,
        expiryDate: it.batches?.[0]?.expiryDate,
        qty: it.qty,
        status: "returned",
        receivedAt: new Date(),
        note: `${order.number}: ${reason}`,
      },
      { session: s },
    );
  }
  await move("return", order.items, s, { orderId: order._id, by, reason });
}

// ---------- admin stock operations ----------

export async function receiveStock(actor: Actor, i: { variantId: string; qty: number; batchNo: string; expiryDate?: Date; note?: string }) {
  if (!Number.isInteger(i.qty) || i.qty <= 0) throw new AppError("Quantity must be a positive whole number.");
  const variantId = new ObjectId(i.variantId);
  await withTxn(async (s) => {
    const r = await C.variants.updateOne({ _id: variantId }, { $inc: { available: i.qty }, $set: { updatedAt: new Date() } }, { session: s });
    if (!r.matchedCount) throw new AppError("Variant not found.");
    const { insertedId } = await C.batches.insertOne(
      { _id: new ObjectId(), variantId, batchNo: i.batchNo || "UNBATCHED", expiryDate: i.expiryDate, qty: i.qty, status: "sellable", receivedAt: new Date(), note: i.note },
      { session: s },
    );
    await move("receive", [{ variantId, qty: i.qty }], s, { by: actor.id, batchId: insertedId, reason: i.note });
  });
  await audit(actor, "stock.receive", "variant", i.variantId, `+${i.qty} batch ${i.batchNo}`);
}

/** Count correction. Negative takes from batches earliest-expiry first. */
export async function adjustStock(actor: Actor, i: { variantId: string; delta: number; reason: string }) {
  if (!Number.isInteger(i.delta) || i.delta === 0) throw new AppError("Adjustment must be a non-zero whole number.");
  if (!i.reason.trim()) throw new AppError("A reason is required for stock adjustments.");
  const variantId = new ObjectId(i.variantId);
  await withTxn(async (s) => {
    if (i.delta > 0) {
      await C.variants.updateOne({ _id: variantId }, { $inc: { available: i.delta } }, { session: s });
      await C.batches.insertOne({ _id: new ObjectId(), variantId, batchNo: "ADJUSTMENT", qty: i.delta, status: "sellable", receivedAt: new Date(), note: i.reason }, { session: s });
    } else {
      const n = -i.delta;
      const r = await C.variants.updateOne({ _id: variantId, available: { $gte: n } }, { $inc: { available: -n } }, { session: s });
      if (!r.modifiedCount) throw new AppError("Cannot remove more than the available (unreserved) quantity.");
      await takeFefo(variantId, n, s);
    }
    await move("adjust", [{ variantId, qty: i.delta }], s, { by: actor.id, reason: i.reason });
  });
  await audit(actor, "stock.adjust", "variant", i.variantId, `${i.delta > 0 ? "+" : ""}${i.delta}: ${i.reason}`);
}

/** Move units out of a sellable batch into damaged/expired, or between segregated states. */
export async function moveBatch(actor: Actor, i: { batchId: string; qty: number; to: BatchStatus; reason: string }) {
  if (!Number.isInteger(i.qty) || i.qty <= 0) throw new AppError("Quantity must be a positive whole number.");
  if (!i.reason.trim()) throw new AppError("A reason is required.");
  await withTxn(async (s) => {
    const b = await C.batches.findOne({ _id: new ObjectId(i.batchId) }, { session: s });
    if (!b) throw new AppError("Batch not found.");
    if (b.qty < i.qty) throw new AppError("Not enough units in this batch.");
    const allowed: Record<BatchStatus, BatchStatus[]> = {
      sellable: ["damaged", "expired"],
      returned: ["sellable", "damaged", "expired", "disposed"],
      damaged: ["disposed"],
      expired: ["disposed"],
      disposed: [],
    };
    if (!allowed[b.status].includes(i.to)) throw new AppError(`Cannot move ${b.status} stock to ${i.to}.`);
    if (b.status === "sellable") {
      const r = await C.variants.updateOne({ _id: b.variantId, available: { $gte: i.qty } }, { $inc: { available: -i.qty } }, { session: s });
      if (!r.modifiedCount) throw new AppError("Those units are reserved for open orders. Release or substitute first.");
    }
    if (i.to === "sellable") {
      if (b.expiryDate && b.expiryDate < new Date()) throw new AppError("Expired stock cannot be made sellable.");
      await C.variants.updateOne({ _id: b.variantId }, { $inc: { available: i.qty } }, { session: s });
    }
    await C.batches.updateOne({ _id: b._id }, { $inc: { qty: -i.qty } }, { session: s });
    const { insertedId } = await C.batches.insertOne(
      { _id: new ObjectId(), variantId: b.variantId, batchNo: b.batchNo, expiryDate: b.expiryDate, qty: i.qty, status: i.to, receivedAt: new Date(), note: i.reason },
      { session: s },
    );
    const type = i.to === "sellable" ? "restock" : i.to === "disposed" ? "dispose" : i.to === "expired" ? "expire" : "damage";
    await move(type, [{ variantId: b.variantId, qty: i.qty }], s, { by: actor.id, reason: i.reason, batchId: insertedId });
  });
  await audit(actor, `stock.${i.to}`, "batch", i.batchId, `${i.qty} unit(s): ${i.reason}`);
}

/** Daily: sellable batches past expiry are segregated. Reserved units cannot be pulled, so those raise an alert. */
export async function expireBatches(now = new Date()) {
  const due = await C.batches.find({ status: "sellable", qty: { $gt: 0 }, expiryDate: { $lt: now } }).toArray();
  for (const b of due) {
    await withTxn(async (s) => {
      const v = await C.variants.findOne({ _id: b.variantId }, { session: s });
      const n = Math.min(b.qty, v?.available ?? 0);
      if (n > 0) {
        await C.variants.updateOne({ _id: b.variantId }, { $inc: { available: -n } }, { session: s });
        await C.batches.updateOne({ _id: b._id }, { $inc: { qty: -n } }, { session: s });
        await C.batches.insertOne({ _id: new ObjectId(), variantId: b.variantId, batchNo: b.batchNo, expiryDate: b.expiryDate, qty: n, status: "expired", receivedAt: now, note: "Auto-segregated on expiry" }, { session: s });
        await move("expire", [{ variantId: b.variantId, qty: n }], s, { reason: "expiry", batchId: b._id });
      }
      if (b.qty - n > 0) await raiseAlert("expired_reserved", `Batch ${b.batchNo}: ${b.qty - n} expired unit(s) are reserved for open orders. Substitute before packing.`, b._id.toHexString());
    });
  }
  return due.length;
}
