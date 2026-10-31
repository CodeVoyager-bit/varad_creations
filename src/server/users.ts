import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { C } from "@/lib/db";
import { AppError, audit, normalizePhone, randomToken, type Actor } from "./core";
import { endUserSessions } from "./delivery-access";

/** Phone accounts still need a unique email in Better Auth's schema; this one is never contacted. */
const placeholderEmail = (phone: string) => `${phone.replace("+", "")}@phone.varad.invalid`;

export async function createPhoneUser(i: {
  name: string;
  phone: string;
  password?: string;
  role: "customer" | "admin" | "delivery";
  partnerType?: "permanent" | "temporary";
  extra?: Record<string, unknown>;
}) {
  const phone = normalizePhone(i.phone);
  if (!phone) throw new AppError("Enter a valid 10-digit Indian mobile number.");
  if (await C.users.findOne({ phoneNumber: phone })) throw new AppError("An account with this phone number already exists.", "exists");
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser({
    email: placeholderEmail(phone),
    name: i.name.trim().slice(0, 80),
    emailVerified: false,
    phoneNumber: phone,
    phoneNumberVerified: true,
    role: i.role,
    partnerType: i.partnerType ?? null,
    disabled: false,
    ...i.extra,
  }, { method: "phone-number" });
  // accounts without a known password get a random one; the owner sets theirs via OTP reset
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(i.password ?? randomToken(24)),
  });
  return user;
}

export async function createPartner(actor: Actor, i: { name: string; phone: string }) {
  const u = await createPhoneUser({ ...i, role: "delivery", partnerType: "permanent" });
  await audit(actor, "partner.create", "user", u.id, `${i.name} (permanent)`);
  return u;
}

export async function setUserDisabled(actor: Actor, userId: string, disabled: boolean) {
  const u = await C.users.findOne({ _id: new ObjectId(userId) });
  if (!u) throw new AppError("User not found.");
  if (u.role === "admin" && disabled && (await C.users.countDocuments({ role: "admin", disabled: { $ne: true } })) <= 1)
    throw new AppError("You can't disable the last admin.");
  await C.users.updateOne({ _id: u._id }, { $set: { disabled, updatedAt: new Date() } });
  if (disabled) await endUserSessions(userId);
  await audit(actor, disabled ? "user.disable" : "user.enable", "user", userId, u.name);
}
