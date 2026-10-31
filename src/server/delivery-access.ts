import { ObjectId } from "mongodb";
import { C, type AuthUserDoc } from "@/lib/db";
import type { DeliveryBatchDoc } from "@/lib/types";
import { sha256 } from "./core";

export const ACTIVE_BATCH = { $in: ["assigned", "in_progress"] as DeliveryBatchDoc["status"][] };

/** Single use: the first redemption flips usedAt atomically; every later attempt finds nothing. */
export async function redeemInvite(token: string) {
  const now = new Date();
  const inv = await C.invites.findOneAndUpdate(
    { tokenHash: sha256(token), usedAt: null, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { returnDocument: "after" },
  );
  if (!inv) return null;
  const [batch, user] = await Promise.all([
    C.deliveryBatches.findOne({ _id: inv.batchId, status: ACTIVE_BATCH }),
    C.users.findOne({ _id: new ObjectId(inv.userId) }),
  ]);
  if (!batch || !user || !isTempAccessValid(user, now) || user.activeBatchId !== batch._id.toHexString()) return null;
  return { userId: inv.userId, expiresAt: user.accessExpiresAt! };
}

function isTempAccessValid(u: Pick<AuthUserDoc, "role" | "partnerType" | "disabled" | "accessExpiresAt">, now: Date) {
  return u.role === "delivery" && u.partnerType === "temporary" && !u.disabled && !!u.accessExpiresAt && new Date(u.accessExpiresAt) > now;
}

export async function endUserSessions(userId: string) {
  await C.sessions.deleteMany({ userId: { $in: [userId, ...(ObjectId.isValid(userId) ? [new ObjectId(userId)] : [])] } });
}

export interface PartnerUser {
  id: string;
  role: string;
  partnerType?: string | null;
  activeBatchId?: string | null;
  accessExpiresAt?: Date | string | null;
  disabled?: boolean | null;
}

/**
 * The batches a delivery partner may see right now. Permanent partners: their active batches.
 * Temporary partners: exactly one batch, until it completes, is revoked, or access times out —
 * after which their sessions are ended.
 */
export async function partnerBatches(u: PartnerUser): Promise<DeliveryBatchDoc[] | null> {
  if (u.role !== "delivery" || u.disabled) return null;
  if (u.partnerType === "temporary") {
    const ok =
      isTempAccessValid({ role: u.role as "delivery", partnerType: "temporary", disabled: !!u.disabled, accessExpiresAt: u.accessExpiresAt ? new Date(u.accessExpiresAt) : null }, new Date()) &&
      !!u.activeBatchId &&
      ObjectId.isValid(u.activeBatchId);
    const b = ok ? await C.deliveryBatches.findOne({ _id: new ObjectId(u.activeBatchId!), partnerId: u.id, status: ACTIVE_BATCH }) : null;
    if (!b) {
      await endUserSessions(u.id);
      return null;
    }
    return [b];
  }
  return C.deliveryBatches.find({ partnerId: u.id, status: ACTIVE_BATCH }).sort({ createdAt: 1 }).toArray();
}
