"use server";
import { ObjectId } from "mongodb";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { C, nextSeq } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { actorOf, requireUser } from "@/lib/session";
import { AppError, normalizePhone, rateLimit } from "@/server/core";
import { cancelOrder, decideSubstitution, placeOrder } from "@/server/orders";
import { submitUpiReference } from "@/server/payments";
import { loadSettings, serviceability } from "@/server/settings";
import { savePrivateFile } from "@/server/storage";
import { TAGS } from "@/server/storefront";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; code?: string };

/** Expected errors become messages; anything else is logged without request data and hidden. */
async function run<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message, code: e.code };
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_")) throw e; // redirects
    console.error("[action]", (e as Error)?.message);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const addressSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().max(30).default("Home"),
  name: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: z.string(),
  flat: z.string().trim().min(1, "Enter flat / house number").max(80),
  building: z.string().trim().min(2, "Enter building / society").max(120),
  street: z.string().trim().min(2, "Enter street / locality").max(160),
  landmark: z.string().trim().max(120).optional(),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit pincode"),
  city: z.string().trim().min(2).max(60),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  instructions: z.string().trim().max(200).optional(),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.input<typeof addressSchema>;

export async function saveAddress(input: AddressInput) {
  const user = await requireUser("/account");
  return run(async () => {
    const parsed = addressSchema.safeParse(input);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message);
    const a = parsed.data;
    const phone = normalizePhone(a.phone);
    if (!phone) throw new AppError("Enter a valid 10-digit mobile number for delivery.");
    const svc = serviceability(await loadSettings(), a.pincode, a);
    if (!svc.ok) throw new AppError(svc.reason);
    const doc = { ...a, phone, userId: user.id, label: a.label || "Home", isDefault: !!a.isDefault };
    delete (doc as { id?: string }).id;
    if (doc.isDefault) await C.addresses.updateMany({ userId: user.id }, { $set: { isDefault: false } });
    if (a.id) {
      const r = await C.addresses.updateOne({ _id: new ObjectId(a.id), userId: user.id }, { $set: doc });
      if (!r.matchedCount) throw new AppError("Address not found.");
      return { id: a.id };
    }
    if ((await C.addresses.countDocuments({ userId: user.id })) >= 10) throw new AppError("You can save up to 10 addresses.");
    const r = await C.addresses.insertOne({ ...doc, _id: new ObjectId(), createdAt: new Date() });
    return { id: r.insertedId.toHexString() };
  });
}

export async function deleteAddress(id: string) {
  const user = await requireUser();
  return run(async () => {
    await C.addresses.deleteOne({ _id: new ObjectId(id), userId: user.id });
    return {};
  });
}

const orderSchema = z.object({
  idempotencyKey: z.string().min(8).max(80),
  items: z.array(z.object({ variantId: z.string(), qty: z.number().int().min(1).max(24) })).min(1).max(50),
  couponCode: z.string().max(40).optional(),
  addressId: z.string(),
  paymentMethod: z.enum(["upi", "cod"]),
  expectedTotalPaise: z.number().int().min(0),
  customerNote: z.string().max(300).optional(),
});

export async function placeOrderAction(input: z.input<typeof orderSchema>) {
  const user = await requireUser("/checkout");
  return run(async () => {
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Please review your order details.");
    if (!(await rateLimit(`checkout:${user.id}`, 10, 600)) || !(await rateLimit(`checkout-ip:${await clientIp()}`, 30, 600)))
      throw new AppError("Too many attempts. Please wait a few minutes.");
    const o = await placeOrder({ id: user.id, name: user.name }, parsed.data);
    revalidateTag(TAGS.catalog, "max"); // stock changed
    return { orderId: o._id.toHexString() };
  });
}

export async function cancelMyOrder(id: string, reason: string) {
  const user = await requireUser();
  return run(async () => {
    await cancelOrder(actorOf(user), id, reason || "Cancelled by customer");
    revalidateTag(TAGS.catalog, "max");
    return {};
  });
}

export async function submitPayment(form: FormData) {
  const user = await requireUser();
  return run(async () => {
    const id = String(form.get("orderId"));
    const reference = String(form.get("reference") ?? "");
    if (!(await rateLimit(`upi-ref:${user.id}`, 10, 600))) throw new AppError("Too many attempts. Please wait a few minutes.");
    const own = ObjectId.isValid(id) && (await C.orders.findOne({ _id: new ObjectId(id), userId: user.id }, { projection: { _id: 1 } }));
    if (!own) throw new AppError("Order not found.");
    const file = form.get("proof");
    const proofFileId = file instanceof File && file.size > 0 ? await savePrivateFile(file, { ownerId: user.id, orderId: id, kind: "payment_proof" }) : undefined;
    await submitUpiReference(actorOf(user), id, { reference, proofFileId });
    return {};
  });
}

export async function respondToSubstitution(id: string, approve: boolean) {
  const user = await requireUser();
  return run(async () => {
    await decideSubstitution(actorOf(user), id, approve);
    revalidateTag(TAGS.catalog, "max");
    return {};
  });
}

const supportSchema = z.object({
  orderId: z.string().optional(),
  topic: z.enum(["cancellation", "wrong_item", "damaged", "expired", "missing", "payment", "account_deletion", "other"]),
  message: z.string().trim().min(5, "Tell us a little more").max(1000),
});

export async function createSupportRequest(input: z.input<typeof supportSchema>) {
  const user = await requireUser();
  return run(async () => {
    const p = supportSchema.safeParse(input);
    if (!p.success) throw new AppError(p.error.issues[0].message);
    if (!(await rateLimit(`support:${user.id}`, 10, 3600))) throw new AppError("Too many requests. Please call or WhatsApp us.");
    const order = p.data.orderId && ObjectId.isValid(p.data.orderId) ? await C.orders.findOne({ _id: new ObjectId(p.data.orderId), userId: user.id }) : null;
    const ticket = `VC-T${String(await nextSeq("ticket")).padStart(5, "0")}`;
    await C.support.insertOne({
      _id: new ObjectId(),
      ticket,
      userId: user.id,
      orderId: order?._id,
      orderNumber: order?.number,
      topic: p.data.topic,
      message: p.data.message,
      status: "open",
      createdAt: new Date(),
    });
    return { ticket };
  });
}

export async function updateProfile(name: string) {
  const user = await requireUser();
  return run(async () => {
    if (!name.trim() || name.length > 80) throw new AppError("Enter your name.");
    await C.users.updateOne({ _id: new ObjectId(user.id) }, { $set: { name: name.trim(), updatedAt: new Date() } });
    return {};
  });
}
