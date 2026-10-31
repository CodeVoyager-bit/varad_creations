import { ObjectId } from "mongodb";
import { C, nextSeq, withTxn } from "@/lib/db";
import type { DeliveryBatchDoc, OrderDoc } from "@/lib/types";
import { addHours, AppError, audit, normalizePhone, randomToken, sha256, type Actor } from "./core";
import { ACTIVE_BATCH, endUserSessions, partnerBatches, type PartnerUser } from "./delivery-access";
import { ledger } from "./orders";
import { createPhoneUser } from "./users";

const INVITE_TTL_HOURS = 2;
const RESOLVED: OrderDoc["status"][] = ["delivered", "delivery_failed", "rescheduled", "cancelled"];

type PartnerChoice = { type: "permanent"; userId: string } | { type: "temporary"; name: string; phone: string; accessHours: number };

async function newInvite(actor: Actor, batchId: ObjectId, userId: string) {
  const token = randomToken(32);
  await C.invites.insertOne({
    _id: new ObjectId(),
    tokenHash: sha256(token), // only the hash is stored
    batchId,
    userId,
    expiresAt: addHours(new Date(), INVITE_TTL_HOURS),
    usedAt: null,
    revokedAt: null,
    createdBy: actor.id,
    createdAt: new Date(),
  });
  return token;
}

export async function createBatch(actor: Actor, i: { orderIds: string[]; partner: PartnerChoice }) {
  const ids = [...new Set(i.orderIds)].filter(ObjectId.isValid).map((x) => new ObjectId(x));
  if (!ids.length) throw new AppError("Select at least one order.");
  const orders = await C.orders.find({ _id: { $in: ids } }).toArray();
  if (orders.length !== ids.length || orders.some((o) => !["ready_for_dispatch", "rescheduled"].includes(o.status) || o.delivery.batchId))
    throw new AppError("Only unassigned orders that are ready for dispatch (or rescheduled) can be batched.");

  let partner: { id: string; name: string; phone: string };
  let accessExpiresAt: Date | undefined;
  const batchId = new ObjectId();
  if (i.partner.type === "permanent") {
    const u = ObjectId.isValid(i.partner.userId) ? await C.users.findOne({ _id: new ObjectId(i.partner.userId) }) : null;
    if (!u || u.role !== "delivery" || u.partnerType !== "permanent" || u.disabled) throw new AppError("Choose an active permanent partner.");
    partner = { id: u._id.toHexString(), name: u.name, phone: u.phoneNumber ?? "" };
  } else {
    const phone = normalizePhone(i.partner.phone);
    if (!phone) throw new AppError("Enter the partner's 10-digit mobile number.");
    const hours = Math.min(Math.max(Math.round(i.partner.accessHours), 1), 24);
    accessExpiresAt = addHours(new Date(), hours);
    const existing = await C.users.findOne({ phoneNumber: phone });
    if (existing && (existing.role !== "delivery" || existing.partnerType !== "temporary"))
      throw new AppError("This number belongs to a customer or staff account. Use a permanent partner or a different number.");
    if (existing?.activeBatchId && (await C.deliveryBatches.findOne({ _id: new ObjectId(existing.activeBatchId), status: ACTIVE_BATCH })))
      throw new AppError("This temporary partner already has an active batch.");
    const fields = { partnerType: "temporary" as const, accessExpiresAt, activeBatchId: batchId.toHexString() };
    if (existing) {
      await C.users.updateOne({ _id: existing._id }, { $set: { ...fields, name: i.partner.name.trim() || existing.name, disabled: false, updatedAt: new Date() } });
      partner = { id: existing._id.toHexString(), name: existing.name, phone };
    } else {
      const u = await createPhoneUser({ name: i.partner.name || "Delivery partner", phone, role: "delivery", partnerType: "temporary", extra: fields });
      partner = { id: u.id, name: u.name, phone };
    }
  }

  const batch: DeliveryBatchDoc = {
    _id: batchId,
    code: `PUNE-${String(await nextSeq("batch")).padStart(3, "0")}`,
    partnerId: partner.id,
    partnerName: partner.name,
    partnerPhone: partner.phone,
    partnerType: i.partner.type,
    orderIds: ids,
    status: "assigned",
    accessExpiresAt,
    createdBy: actor.id,
    createdAt: new Date(),
  };
  await withTxn(async (s) => {
    const r = await C.orders.updateMany(
      { _id: { $in: ids }, status: { $in: ["ready_for_dispatch", "rescheduled"] }, "delivery.batchId": null },
      {
        $set: { "delivery.batchId": batchId, "delivery.partnerId": partner.id, updatedAt: new Date() },
        $push: { timeline: { at: new Date(), event: `Assigned to delivery batch ${batch.code}`, by: actor.name } },
      },
      { session: s },
    );
    if (r.modifiedCount !== ids.length) throw new AppError("Some orders were assigned elsewhere just now. Refresh and try again.");
    await C.deliveryBatches.insertOne(batch, { session: s });
  });
  const token = i.partner.type === "temporary" ? await newInvite(actor, batchId, partner.id) : undefined;
  await audit(actor, "delivery.batch.create", "batch", batchId.toHexString(), `${batch.code} → ${partner.name} (${i.partner.type}), ${ids.length} order(s)`);
  return { batch, token };
}

/** Admin re-verified the partner (e.g. by phone): old links die, old sessions end, a new link is issued. */
export async function reissueInvite(actor: Actor, batchId: string) {
  const b = await C.deliveryBatches.findOne({ _id: new ObjectId(batchId), status: ACTIVE_BATCH, partnerType: "temporary" });
  if (!b) throw new AppError("Only active temporary batches have invite links.");
  const u = await C.users.findOne({ _id: new ObjectId(b.partnerId) });
  if (!u?.accessExpiresAt || u.accessExpiresAt < new Date()) {
    const accessExpiresAt = addHours(new Date(), 8);
    await C.users.updateOne({ _id: new ObjectId(b.partnerId) }, { $set: { accessExpiresAt } });
    await C.deliveryBatches.updateOne({ _id: b._id }, { $set: { accessExpiresAt } });
  }
  await C.invites.updateMany({ batchId: b._id, usedAt: null, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await endUserSessions(b.partnerId);
  const token = await newInvite(actor, b._id, b.partnerId);
  await audit(actor, "delivery.invite.reissue", "batch", batchId, b.code);
  return token;
}

export async function revokeBatch(actor: Actor, batchId: string, reason: string) {
  const b = await C.deliveryBatches.findOne({ _id: new ObjectId(batchId), status: ACTIVE_BATCH });
  if (!b) throw new AppError("Batch is not active.");
  await C.deliveryBatches.updateOne({ _id: b._id }, { $set: { status: "revoked", completedAt: new Date() } });
  // undelivered orders return to the dispatch queue
  await C.orders.updateMany(
    { _id: { $in: b.orderIds }, status: { $in: ["ready_for_dispatch", "rescheduled"] } },
    { $set: { "delivery.batchId": null, "delivery.partnerId": null }, $push: { timeline: { at: new Date(), event: `Removed from batch ${b.code}`, by: actor.name } } },
  );
  await endTempAccess(b);
  await audit(actor, "delivery.batch.revoke", "batch", batchId, reason);
}

async function endTempAccess(b: DeliveryBatchDoc) {
  if (b.partnerType !== "temporary") return;
  await C.invites.updateMany({ batchId: b._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await C.users.updateOne({ _id: new ObjectId(b.partnerId) }, { $set: { accessExpiresAt: new Date(), activeBatchId: null } });
  await endUserSessions(b.partnerId);
}

async function maybeCompleteBatch(batchId?: ObjectId) {
  if (!batchId) return;
  const b = await C.deliveryBatches.findOne({ _id: batchId, status: ACTIVE_BATCH });
  if (!b) return;
  const open = await C.orders.countDocuments({ _id: { $in: b.orderIds }, "delivery.batchId": b._id, status: { $nin: RESOLVED } });
  if (open) return;
  const r = await C.deliveryBatches.updateOne({ _id: b._id, status: ACTIVE_BATCH }, { $set: { status: "completed", completedAt: new Date() } });
  if (r.modifiedCount) await endTempAccess(b);
}

// ---------- partner actions (scope enforced on every call) ----------

/** Loads an order only if it's in one of the partner's current batches. */
export async function partnerOrder(u: PartnerUser, orderId: string) {
  const batches = await partnerBatches(u);
  if (!batches || !ObjectId.isValid(orderId)) throw new AppError("Not found.", "not_found");
  const oid = new ObjectId(orderId);
  const b = batches.find((x) => x.orderIds.some((id) => id.equals(oid)));
  const o = b && (await C.orders.findOne({ _id: oid, "delivery.batchId": b._id }));
  if (!o) throw new AppError("Not found.", "not_found");
  return o;
}

/** Only what a partner needs to deliver; no payment evidence, no customer account data. */
export function partnerView(o: OrderDoc) {
  return {
    id: o._id.toHexString(),
    number: o.number,
    status: o.status,
    address: o.address,
    items: o.items.map((i) => ({ name: i.name, brand: i.brand, variantLabel: i.variantLabel, qty: i.qty, image: i.image })),
    paymentMethod: o.paymentMethod,
    amountToCollectPaise: o.paymentMethod === "cod" && o.paymentStatus === "cod_due" ? o.pricing.totalPaise : 0,
    prepaid: o.paymentMethod === "upi",
    cod: o.cod ? { collectedPaise: o.cod.collectedPaise, method: o.cod.method } : null,
    attempts: o.delivery.attempts.map((a) => ({ at: a.at, reason: a.reason })),
    deliveredAt: o.delivery.deliveredAt,
    customerNote: o.customerNote,
  };
}

export async function partnerHome(u: PartnerUser) {
  const batches = await partnerBatches(u);
  if (!batches) return null;
  const orders = await C.orders.find({ "delivery.batchId": { $in: batches.map((b) => b._id) } }).sort({ "address.pincode": 1 }).toArray();
  return { batches, orders };
}

export async function pickUpBatch(u: PartnerUser & { name?: string }, batchId: string) {
  const batches = await partnerBatches(u);
  const b = batches?.find((x) => x._id.toHexString() === batchId);
  if (!b) throw new AppError("Not found.", "not_found");
  const now = new Date();
  await C.orders.updateMany(
    { _id: { $in: b.orderIds }, "delivery.batchId": b._id, status: { $in: ["ready_for_dispatch", "rescheduled"] } },
    { $set: { status: "out_for_delivery", updatedAt: now }, $push: { timeline: { at: now, event: "Out for delivery", by: u.name ?? "Delivery partner" } } },
  );
  await C.deliveryBatches.updateOne({ _id: b._id, status: "assigned" }, { $set: { status: "in_progress" } });
}

export async function markDelivered(
  actor: Actor,
  scope: PartnerUser | "admin",
  orderId: string,
  i: { confirm: boolean; note?: string; cod?: { method: "cash" | "upi"; amountPaise: number; reference?: string } },
) {
  if (!i.confirm) throw new AppError("Please confirm the handover.");
  const o = scope === "admin" ? await C.orders.findOne({ _id: new ObjectId(orderId) }) : await partnerOrder(scope, orderId);
  if (!o) throw new AppError("Not found.", "not_found");
  if (o.status !== "out_for_delivery") throw new AppError("Only orders that are out for delivery can be marked delivered.");
  const now = new Date();
  const set: Record<string, unknown> = { status: "delivered", "delivery.deliveredAt": now, "delivery.deliveredBy": actor.id, updatedAt: now };
  if (i.note) set["delivery.note"] = i.note.slice(0, 300);
  if (o.paymentMethod === "cod" && o.paymentStatus === "cod_due") {
    if (!i.cod) throw new AppError("Record the cash/UPI collection before marking this COD order delivered.");
    if (i.cod.amountPaise !== o.pricing.totalPaise) throw new AppError("Collected amount must equal the amount due. Contact the shop if the customer paid a different amount.");
    Object.assign(set, {
      paymentStatus: "collection_recorded",
      amountReceivedPaise: i.cod.amountPaise,
      cod: { collectedPaise: i.cod.amountPaise, method: i.cod.method, reference: i.cod.reference?.slice(0, 40), recordedBy: actor.id, recordedAt: now },
    });
  } else if (o.paymentMethod === "upi" && o.paymentStatus !== "paid" && !o.paymentStatus.includes("refund")) {
    throw new AppError("This prepaid order is not marked paid. Contact the shop before handing it over.");
  }
  await withTxn(async (s) => {
    const r = await C.orders.updateOne(
      { _id: o._id, status: "out_for_delivery" },
      { $set: set, $push: { timeline: { at: now, event: "Delivered", by: actor.name ?? "Delivery partner", note: i.note } } },
      { session: s },
    );
    if (!r.modifiedCount) throw new AppError("Already updated.", "conflict");
    if (set.cod) await ledger(o, { type: "cod_collected", amountPaise: i.cod!.amountPaise, method: i.cod!.method, reference: i.cod!.reference, by: actor.id, byRole: actor.role }, s);
  });
  await audit(actor, "delivery.delivered", "order", orderId, i.cod ? `COD ${i.cod.method} ₹${i.cod.amountPaise / 100}` : undefined);
  await maybeCompleteBatch(o.delivery.batchId);
}

export const FAILURE_REASONS = ["Customer not reachable", "Customer not at address", "Address incomplete / not found", "Customer refused delivery", "Customer asked to reschedule", "Payment not available (COD)", "Other"];

export async function markFailed(actor: Actor, scope: PartnerUser | "admin", orderId: string, reason: string, note?: string) {
  if (!FAILURE_REASONS.includes(reason)) throw new AppError("Choose a reason.");
  const o = scope === "admin" ? await C.orders.findOne({ _id: new ObjectId(orderId) }) : await partnerOrder(scope, orderId);
  if (!o) throw new AppError("Not found.", "not_found");
  const now = new Date();
  const r = await C.orders.updateOne(
    { _id: o._id, status: "out_for_delivery" },
    {
      $set: { status: "delivery_failed", updatedAt: now },
      $push: { "delivery.attempts": { at: now, reason, note: note?.slice(0, 300), by: actor.id }, timeline: { at: now, event: "Delivery attempt unsuccessful", by: actor.name, note: reason } },
    },
  );
  if (!r.modifiedCount) throw new AppError("Only orders out for delivery can be marked unsuccessful.");
  await audit(actor, "delivery.failed", "order", orderId, reason);
  await maybeCompleteBatch(o.delivery.batchId);
}
