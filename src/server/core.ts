import { createHash, randomBytes } from "node:crypto";
import { C } from "@/lib/db";
import type { Role } from "@/lib/types";

export interface Actor {
  id: string;
  role: Role | "system";
  name?: string;
}

export const SYSTEM: Actor = { id: "system", role: "system", name: "System" };

/** Expected business errors; the message is safe to show to the user. */
export class AppError extends Error {
  constructor(
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

export function normalizePhone(input: string): string | null {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Fixed-window counter in MongoDB (works across serverless instances). */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const bucket = Math.floor(Date.now() / (windowSec * 1000));
  const r = await C.rateLimits.findOneAndUpdate(
    { _id: `${key}:${bucket}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * windowSec * 1000) } },
    { upsert: true, returnDocument: "after" },
  );
  return r!.count <= limit;
}

export async function audit(
  actor: Actor,
  action: string,
  entity: string,
  entityId?: string,
  summary?: string,
  before?: unknown,
  after?: unknown,
) {
  await C.audit.insertOne({ at: new Date(), actorId: actor.id, actorRole: actor.role, action, entity, entityId, summary, before, after });
}

export async function raiseAlert(kind: string, message: string, ref?: string) {
  await C.alerts.updateOne(
    { kind, ref, resolved: false },
    { $setOnInsert: { kind, ref, resolved: false, at: new Date() }, $set: { message } },
    { upsert: true },
  );
}

/** Request-time clock for server components (keeps render code free of direct Date.now calls). */
export const nowMs = () => Date.now();

export const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600_000);
export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
