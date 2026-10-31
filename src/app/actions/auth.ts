"use server";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { C } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { AppError, normalizePhone, rateLimit } from "@/server/core";
import { OtpSendError } from "@/server/otp";
import { createPhoneUser } from "@/server/users";

type Result = { ok: true } | { ok: false; error: string; exists?: boolean };

/**
 * Step 1 of registration. The response is identical whether or not the number already has an
 * account, so it can't be used to discover registered numbers; the owner learns it only after
 * proving they hold the phone.
 */
export async function startRegistration(rawPhone: string): Promise<Result> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: "Enter a valid 10-digit Indian mobile number." };
  const ip = await clientIp();
  if (!(await rateLimit(`reg-otp:ip:${ip}`, 6, 600)) || !(await rateLimit(`reg-otp:ph:${phone}`, 3, 600)))
    return { ok: false, error: "Too many attempts. Please wait 10 minutes and try again." };
  try {
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: phone } });
    return { ok: true };
  } catch (e) {
    if (e instanceof OtpSendError) return { ok: false, error: e.message };
    console.error("[register] send failed", (e as Error).message);
    return { ok: false, error: "Could not send the code. Please try again." };
  }
}

export async function completeRegistration(i: { phone: string; code: string; name: string; password: string }): Promise<Result> {
  const phone = normalizePhone(i.phone);
  if (!phone) return { ok: false, error: "Enter a valid mobile number." };
  if (!i.name.trim() || i.name.length > 80) return { ok: false, error: "Enter your name." };
  if (i.password.length < 8 || i.password.length > 128) return { ok: false, error: "Password must be 8–128 characters." };
  if (!(await rateLimit(`reg-verify:${phone}`, 8, 600))) return { ok: false, error: "Too many attempts. Please request a new code later." };
  try {
    await auth.api.consumePhoneNumberOTP({ body: { phoneNumber: phone, code: i.code.trim() } });
  } catch (e) {
    if (e instanceof APIError) return { ok: false, error: "That code is incorrect or has expired." };
    throw e;
  }
  if (await C.users.findOne({ phoneNumber: phone }))
    return { ok: false, exists: true, error: "This number already has an account. Sign in, or reset your password if you've forgotten it." };
  try {
    await createPhoneUser({ name: i.name, phone, password: i.password, role: "customer" });
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    throw e;
  }
  await auth.api.signInPhoneNumber({ body: { phoneNumber: phone, password: i.password, rememberMe: true }, headers: await headers() });
  return { ok: true };
}
