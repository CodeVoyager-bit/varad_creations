import { ObjectId } from "mongodb";
import { C } from "@/lib/db";
import { AppError, audit, type Actor } from "./core";

/**
 * A signed-in customer asks to hear when an out-of-stock pack is back. The shop messages them
 * itself (WhatsApp from the inventory page), so the request keeps the account's name and phone.
 * Asking again after being notified re-opens the request.
 */
export async function requestRestock(userId: string, variantId: string) {
  const v = ObjectId.isValid(variantId) ? await C.variants.findOne({ _id: new ObjectId(variantId), active: true }) : null;
  const p = v && (await C.products.findOne({ _id: v.productId, status: "active" }));
  if (!v || !p) throw new AppError("This product isn't available.", "not_found");
  if (v.available > 0) throw new AppError("Good news — it's in stock now. You can add it to your cart.", "in_stock");
  const u = ObjectId.isValid(userId) ? await C.users.findOne({ _id: new ObjectId(userId) }, { projection: { name: 1, phoneNumber: 1 } }) : null;
  if (!u?.phoneNumber) throw new AppError("Add a phone number to your account so we can reach you.", "no_phone");
  await C.restockRequests.updateOne(
    { variantId: v._id, userId },
    { $set: { productId: p._id, name: u.name, phone: u.phoneNumber, createdAt: new Date() }, $unset: { notifiedAt: "" } },
    { upsert: true },
  );
}

/** Admin: everyone waiting for this pack has been told. */
export async function markRestockNotified(actor: Actor, variantId: string) {
  if (!ObjectId.isValid(variantId)) throw new AppError("Not found.", "not_found");
  const r = await C.restockRequests.updateMany({ variantId: new ObjectId(variantId), notifiedAt: { $exists: false } }, { $set: { notifiedAt: new Date() } });
  await audit(actor, "restock.notified", "variant", variantId, `${r.modifiedCount} customer(s) told it's back`);
  return r.modifiedCount;
}

/** Open requests grouped by pack: packs already back on the shelf first, then the most wanted. */
export async function restockWaitlist() {
  const open = await C.restockRequests.find({ notifiedAt: { $exists: false } }).sort({ createdAt: 1 }).toArray();
  if (!open.length) return [];
  const variants = await C.variants.find({ _id: { $in: open.map((r) => r.variantId) } }).toArray();
  const products = await C.products.find({ _id: { $in: variants.map((v) => v.productId) } }, { projection: { name: 1, slug: 1 } }).toArray();
  return variants
    .map((v) => ({
      variantId: v._id.toHexString(),
      label: v.label,
      available: v.available,
      product: products.find((p) => p._id.equals(v.productId)),
      requests: open.filter((r) => r.variantId.equals(v._id)),
    }))
    .sort((a, b) => Number(b.available > 0) - Number(a.available > 0) || b.requests.length - a.requests.length);
}
