import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber, twoFactor } from "better-auth/plugins";
import { ObjectId } from "mongodb";
import { after } from "next/server";
import { z } from "zod";
import { client, db } from "./db";
import { otpMode, sendOtp, verifyOtpWithProvider } from "@/server/otp";
import { normalizePhone } from "@/server/core";
import { redeemInvite } from "@/server/delivery-access";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Temporary delivery partners: a single-use invite token becomes a Better Auth session
 * that ends when their batch access ends. Redemption is atomic (see redeemInvite).
 */
const deliveryInvite = () =>
  ({
    id: "delivery-invite",
    endpoints: {
      redeemDeliveryInvite: createAuthEndpoint(
        "/delivery-invite/redeem",
        { method: "POST", body: z.object({ token: z.string().min(20).max(200) }) },
        async (ctx) => {
          const r = await redeemInvite(ctx.body.token);
          if (!r) throw new APIError("UNAUTHORIZED", { message: "This link has expired or was already used. Ask the shop for a new link." });
          const session = await ctx.context.internalAdapter.createSession(r.userId, false, { expiresAt: r.expiresAt }, true);
          const user = await ctx.context.internalAdapter.findUserById(r.userId);
          if (!session || !user) throw new APIError("INTERNAL_SERVER_ERROR");
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ ok: true });
        },
      ),
    },
    rateLimit: [{ pathMatcher: (p: string) => p === "/delivery-invite/redeem", window: 60, max: 5 }],
  }) satisfies BetterAuthPlugin;

export const auth = betterAuth({
  appName: "Varad Creation",
  baseURL: siteUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(db, { client }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
  // phone + password is the only sign-in; OTP-login and email routes are switched off
  disabledPaths: [
    "/sign-up/email",
    "/sign-in/email",
    "/request-password-reset",
    "/reset-password",
    "/phone-number/send-otp",
    "/phone-number/verify",
    "/change-email",
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  user: {
    deleteUser: { enabled: false },
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "customer" },
      partnerType: { type: "string", input: false, required: false },
      accessExpiresAt: { type: "date", input: false, required: false },
      activeBatchId: { type: "string", input: false, required: false },
      disabled: { type: "boolean", input: false, defaultValue: false },
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/phone-number": { window: 300, max: 10 },
      "/phone-number/request-password-reset": { window: 600, max: 3 },
      "/phone-number/reset-password": { window: 600, max: 10 },
      "/two-factor/verify-totp": { window: 300, max: 10 },
    },
  },
  advanced: {
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },
  databaseHooks: {
    session: {
      create: {
        // disabled accounts can't start sessions, whatever route they come through
        before: async (session) => {
          const u = await db.collection("user").findOne({ _id: new ObjectId(String(session.userId)) });
          if (u?.disabled) return false;
        },
      },
    },
  },
  plugins: [
    phoneNumber({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
      requireVerification: true,
      phoneNumberValidator: (p) => normalizePhone(p) === p,
      sendOTP: ({ phoneNumber, code }) => sendOtp(phoneNumber, code),
      // returns immediately so response time doesn't reveal whether the number has an account
      sendPasswordResetOTP: ({ phoneNumber, code }) => {
        after(() => sendOtp(phoneNumber, code).catch((e) => console.error("[otp] reset send failed", e.message)));
      },
      ...(otpMode === "minimoth" ? { verifyOTP: ({ phoneNumber, code }) => verifyOtpWithProvider(phoneNumber, code) } : {}),
    }),
    twoFactor({ issuer: "Varad Creation Admin" }),
    deliveryInvite(),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
