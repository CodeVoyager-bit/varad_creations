import { ObjectId } from "mongodb";
import { C, withTxn } from "@/lib/db";
import { canMovePayment, PAYMENT_LABEL } from "@/lib/order-rules";
import type { OrderDoc, PaymentStatus } from "@/lib/types";
import { addHours, AppError, audit, type Actor } from "./core";
import { confirmOrder, lapseIfDue, ledger } from "./orders";
import { loadSettings } from "./settings";

/** Conditional on the current payment status, so double clicks and races cannot double-apply. */
async function setPayment(o: OrderDoc, to: PaymentStatus, set: Record<string, unknown>, event: string, actor: Actor, s?: import("mongodb").ClientSession) {
  if (!canMovePayment(o.paymentStatus, to)) throw new AppError(`Payment cannot move from "${PAYMENT_LABEL[o.paymentStatus]}" to "${PAYMENT_LABEL[to]}".`);
  const now = new Date();
  const r = await C.orders.updateOne(
    { _id: o._id, paymentStatus: o.paymentStatus },
    { $set: { paymentStatus: to, updatedAt: now, ...set }, $push: { timeline: { at: now, event, by: actor.name ?? actor.role } } },
    { session: s },
  );
  if (!r.modifiedCount) throw new AppError("This payment was just updated elsewhere. Refresh and try again.", "conflict");
}

const find = async (id: string, filter: Record<string, unknown> = {}) => {
  const o = ObjectId.isValid(id) ? await C.orders.findOne({ _id: new ObjectId(id), ...filter }) : null;
  if (!o) throw new AppError("Order not found.", "not_found");
  return o;
};

/** Customer says they paid. This never marks the order paid. */
export async function submitUpiReference(actor: Actor, id: string, i: { reference: string; proofFileId?: string }) {
  const ref = i.reference.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,35}$/.test(ref)) throw new AppError("Enter the UPI transaction ID / UTR exactly as shown in your UPI app.");
  await lapseIfDue(id);
  const o = await find(id, { userId: actor.id });
  if (o.paymentMethod !== "upi") throw new AppError("This order is not a UPI order.");
  if (o.status === "cancelled") throw new AppError("This order was cancelled. If you already paid, please raise a payment support request with your UTR.");
  if (o.paymentStatus === "verification_pending" && o.upi?.reference === ref) return;
  if (!["awaiting_payment", "verification_pending"].includes(o.paymentStatus)) throw new AppError("Payment details can't be changed now.");
  const settings = await loadSettings();
  const now = new Date();
  const hold = addHours(now, settings.delivery.verificationHoldHours);
  const set: Record<string, unknown> = {
    "upi.reference": ref,
    "upi.submittedAt": now,
    "upi.clarification": null,
    ...(i.proofFileId ? { "upi.proofFileId": new ObjectId(i.proofFileId) } : {}),
  };
  // keep stock held while the shop verifies
  if (o.stock === "reserved" && (!o.reservationExpiresAt || o.reservationExpiresAt < hold)) set.reservationExpiresAt = hold;
  const to = "verification_pending";
  if (o.paymentStatus === to) {
    await C.orders.updateOne({ _id: o._id, paymentStatus: to }, { $set: { ...set, updatedAt: now } });
  } else await setPayment(o, to, set, "UPI reference submitted — verification pending", actor);
  await ledger(o, { type: "upi_reference_submitted", amountPaise: o.pricing.totalPaise, method: "upi", reference: ref, by: actor.id, byRole: "customer" });
}

/** Admin confirms the money is actually in the bank/UPI account. */
export async function verifyUpiPayment(actor: Actor, id: string, i: { amountPaise: number; note?: string; accept?: boolean }) {
  await lapseIfDue(id);
  const o = await find(id);
  if (o.paymentMethod !== "upi") throw new AppError("Not a UPI order.");
  if (i.amountPaise !== o.pricing.totalPaise)
    throw new AppError("The received amount must match the order total. If it differs, request clarification from the customer instead.");
  const now = new Date();
  const set = { amountReceivedPaise: i.amountPaise, "upi.verifiedBy": actor.id, "upi.verifiedAt": now };
  await withTxn(async (s) => {
    if (o.status === "cancelled") {
      // money arrived for an order that no longer exists: record it and open a refund
      if (!["void", "verification_pending", "awaiting_payment"].includes(o.paymentStatus)) throw new AppError("Payment already recorded.");
      await C.orders.updateOne(
        { _id: o._id, paymentStatus: o.paymentStatus },
        { $set: { ...set, paymentStatus: "refund_pending", refundPendingPaise: i.amountPaise, exception: null }, $push: { timeline: { at: now, event: "Late payment received — refund opened", by: actor.name } } },
        { session: s },
      );
      await ledger(o, { type: "upi_verified", amountPaise: i.amountPaise, method: "upi", reference: o.upi?.reference, note: i.note, by: actor.id, byRole: "admin" }, s);
      await ledger(o, { type: "refund_initiated", amountPaise: i.amountPaise, by: actor.id, byRole: "admin", note: "Payment received after cancellation" }, s);
      return;
    }
    await setPayment(o, "paid", set, "Payment verified", actor, s);
    await ledger(o, { type: "upi_verified", amountPaise: i.amountPaise, method: "upi", reference: o.upi?.reference, note: i.note, by: actor.id, byRole: "admin" }, s);
  });
  await audit(actor, "payment.verify", "order", id, `UPI ${o.upi?.reference ?? "(no ref)"} ₹${i.amountPaise / 100}`);
  if (i.accept && o.status === "placed") await confirmOrder(actor, id);
}

export async function requestClarification(actor: Actor, id: string, message: string) {
  if (!message.trim()) throw new AppError("Tell the customer what to check.");
  const o = await find(id);
  const settings = await loadSettings();
  const deadline = addHours(new Date(), settings.delivery.verificationHoldHours);
  await setPayment(
    o,
    "awaiting_payment",
    { "upi.clarification": message.slice(0, 300), paymentDeadline: deadline, ...(o.stock === "reserved" ? { reservationExpiresAt: deadline } : {}) },
    "Payment clarification requested",
    actor,
  );
  await ledger(o, { type: "clarification_requested", amountPaise: 0, note: message, by: actor.id, byRole: "admin" });
  await audit(actor, "payment.clarify", "order", id, message);
}

/** Cancelled order whose pending verification turned out to be unpaid. */
export async function markNoPayment(actor: Actor, id: string, note: string) {
  const o = await find(id, { status: "cancelled" });
  await setPayment(o, "void", { exception: null }, "No payment received", actor);
  await ledger(o, { type: "payment_voided", amountPaise: 0, note, by: actor.id, byRole: "admin" });
  await audit(actor, "payment.void", "order", id, note);
}

/** Settlement: the partner handed over the COD money. Separate from the customer paying. */
export async function reconcileCod(actor: Actor, ids: string[], note?: string) {
  let n = 0;
  for (const id of ids) {
    const o = await find(id);
    if (!o.cod || o.cod.reconciledAt) continue;
    const now = new Date();
    const r = await C.orders.updateOne(
      { _id: o._id, "cod.reconciledAt": { $exists: false } },
      {
        $set: { "cod.reconciledBy": actor.id, "cod.reconciledAt": now, ...(o.paymentStatus === "collection_recorded" ? { paymentStatus: "paid" } : {}) },
        $push: { timeline: { at: now, event: "COD collection settled with the shop", by: actor.name } },
      },
    );
    if (r.modifiedCount) {
      n++;
      await ledger(o, { type: "cod_reconciled", amountPaise: o.cod.collectedPaise, method: o.cod.method === "cash" ? "cash" : "upi", note, by: actor.id, byRole: "admin" });
    }
  }
  await audit(actor, "payment.reconcile", "order", ids.join(","), `${n} collection(s) settled`);
  return n;
}

export async function initiateRefund(actor: Actor, id: string, amountPaise: number, reason: string) {
  if (!reason.trim()) throw new AppError("A reason is required.");
  const o = await find(id);
  const refundable = o.amountReceivedPaise - o.refundedPaise - o.refundPendingPaise;
  if (!Number.isInteger(amountPaise) || amountPaise <= 0 || amountPaise > refundable)
    throw new AppError(`Refund must be between ₹0.01 and ₹${(refundable / 100).toFixed(2)}.`);
  await setPayment(o, "refund_pending", { refundPendingPaise: o.refundPendingPaise + amountPaise }, `Refund of ₹${amountPaise / 100} initiated`, actor);
  await ledger(o, { type: "refund_initiated", amountPaise, note: reason, by: actor.id, byRole: "admin" });
  await audit(actor, "refund.initiate", "order", id, `₹${amountPaise / 100}: ${reason}`);
}

export async function completeRefund(actor: Actor, id: string, reference: string) {
  if (!reference.trim()) throw new AppError("Enter the refund transaction reference.");
  const o = await find(id, { paymentStatus: "refund_pending" });
  const refunded = o.refundedPaise + o.refundPendingPaise;
  await setPayment(
    o,
    refunded >= o.amountReceivedPaise ? "refunded" : "partially_refunded",
    { refundedPaise: refunded, refundPendingPaise: 0 },
    `Refund of ₹${o.refundPendingPaise / 100} completed`,
    actor,
  );
  await ledger(o, { type: "refund_completed", amountPaise: o.refundPendingPaise, reference: reference.trim(), by: actor.id, byRole: "admin" });
  await audit(actor, "refund.complete", "order", id, reference);
}
