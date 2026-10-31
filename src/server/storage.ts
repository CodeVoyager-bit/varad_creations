import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GridFSBucket, ObjectId } from "mongodb";
import { db } from "@/lib/db";
import { AppError } from "./core";

/**
 * Public product/brand/banner/logo images: Cloudinary (CLOUDINARY_URL) via signed server-side
 * uploads; local public/uploads in development. Production without Cloudinary refuses uploads.
 * Private payment screenshots: GridFS in MongoDB, never public, served only through an
 * authenticated route with short-lived signed links.
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
};

/** Trusts the bytes, not the browser-supplied type. SVG is rejected (can carry script). */
async function readImage(file: File) {
  if (!(file instanceof File) || file.size === 0) throw new AppError("Choose an image.");
  if (file.size > MAX_IMAGE_BYTES) throw new AppError("Image must be 5 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  const type = Object.entries(TYPES).find(([, t]) => t.magic(buf));
  if (!type) throw new AppError("Only JPEG, PNG or WebP images are allowed.");
  return { buf, contentType: type[0], ext: type[1].ext };
}

/** CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name> (Cloudinary dashboard → API Keys). */
function cloudinary() {
  const raw = process.env.CLOUDINARY_URL;
  if (!raw) return null;
  const u = new URL(raw);
  return { cloud: u.hostname, key: decodeURIComponent(u.username), secret: decodeURIComponent(u.password) };
}

/** Cloudinary upload signature: params sorted by name as k=v joined by &, API secret appended, SHA-1. */
export function cloudinarySignature(params: Record<string, string | number>, secret: string) {
  const s = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(s + secret).digest("hex");
}

export async function savePublicImage(file: File, folder: "products" | "brands" | "banners" | "categories" | "site") {
  const { buf, contentType, ext } = await readImage(file);
  const c = cloudinary();
  if (c) {
    const params = { folder: `varad/${folder}`, timestamp: Math.floor(Date.now() / 1000) };
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(buf)], { type: contentType }));
    form.set("api_key", c.key);
    for (const [k, v] of Object.entries(params)) form.set(k, String(v));
    form.set("signature", cloudinarySignature(params, c.secret));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
    const body = (await res.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !body.secure_url) {
      console.error("[storage] Cloudinary upload failed", res.status, body.error?.message);
      throw new AppError("Image upload failed. Please try again.");
    }
    return body.secure_url;
  }
  if (process.env.NODE_ENV === "production") throw new AppError("Image storage is not configured (CLOUDINARY_URL missing).");
  const name = `${folder}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const dest = path.join(process.cwd(), "public", "uploads", name);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return `/uploads/${name}`;
}

const bucket = () => new GridFSBucket(db, { bucketName: "private_files" });

export async function savePrivateFile(file: File, meta: { ownerId: string; orderId: string; kind: "payment_proof" }) {
  const { buf, contentType } = await readImage(file);
  const id = new ObjectId();
  await new Promise<void>((resolve, reject) => {
    const up = bucket().openUploadStreamWithId(id, `${meta.kind}-${meta.orderId}`, { metadata: { ...meta, contentType } });
    up.on("finish", () => resolve()).on("error", reject);
    up.end(buf);
  });
  return id.toHexString();
}

export async function readPrivateFile(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const oid = new ObjectId(id);
  const f = await db.collection("private_files.files").findOne({ _id: oid });
  if (!f) return null;
  const chunks: Buffer[] = [];
  for await (const c of bucket().openDownloadStream(oid)) chunks.push(c as Buffer);
  return { buf: Buffer.concat(chunks), contentType: f.metadata?.contentType as string, ownerId: f.metadata?.ownerId as string };
}

const key = () => {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is required for signed file links");
  return createHmac("sha256", s).update("private-file-links").digest();
};

/** Short-lived link; the file route still checks the viewer's session and role. */
export function signFileUrl(id: string, ttlSeconds = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac("sha256", key()).update(`${id}.${exp}`).digest("base64url");
  return `/api/files/${id}?exp=${exp}&sig=${sig}`;
}

export function verifyFileSig(id: string, exp: string, sig: string) {
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  const expected = createHmac("sha256", key()).update(`${id}.${exp}`).digest();
  const given = Buffer.from(sig, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
