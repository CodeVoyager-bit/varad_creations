import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { connection } from "next/server";
import { GridFSBucket } from "mongodb";
import { db, ensureIndexes } from "@/lib/db";
import { expireBatches } from "@/server/inventory";
import { processReservationExpiries } from "@/server/orders";
import { TAGS } from "@/server/storefront";

const PROOF_RETENTION_DAYS = 180; // stated in the privacy policy

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return !!secret && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** Vercel Cron calls this with Authorization: Bearer $CRON_SECRET. Every step is idempotent. */
export async function GET(req: Request) {
  await connection();
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const reservations = await processReservationExpiries();
  const expiredBatches = await expireBatches();
  const cutoff = new Date(Date.now() - PROOF_RETENTION_DAYS * 86400_000);
  const bucket = new GridFSBucket(db, { bucketName: "private_files" });
  const old = await db.collection("private_files.files").find({ uploadDate: { $lt: cutoff } }, { projection: { _id: 1 } }).toArray();
  for (const f of old) await bucket.delete(f._id);
  await ensureIndexes();
  if (reservations || expiredBatches) revalidateTag(TAGS.catalog, "max");
  return Response.json({ ok: true, reservations, expiredBatches, proofsDeleted: old.length });
}
