import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { auth } from "./auth";
import type { Actor } from "@/server/core";
import { partnerBatches } from "@/server/delivery-access";

/** Admin sessions older than this must sign in again. */
const ADMIN_MAX_SESSION_AGE_MS = 12 * 3600_000;
const ADMIN_REQUIRE_2FA = process.env.NODE_ENV === "production" || process.env.ADMIN_REQUIRE_2FA === "true";

export async function getSession() {
  await connection(); // per-request, never prerendered
  return auth.api.getSession({ headers: await headers() });
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

export const actorOf = (u: SessionUser): Actor => ({ id: u.id, role: u.role as Actor["role"], name: u.name });

export async function requireUser(next = "/account") {
  const s = await getSession();
  if (!s || s.user.disabled) redirect(`/login?next=${encodeURIComponent(next)}`);
  return s.user;
}

/** Every admin page and action goes through this. Hiding buttons is not authorization. */
export async function requireAdmin(opts: { allowSetup?: boolean } = {}) {
  const s = await getSession();
  if (!s || s.user.disabled) redirect("/login?next=/admin");
  if (s.user.role !== "admin") redirect("/");
  if (Date.now() - new Date(s.session.createdAt).getTime() > ADMIN_MAX_SESSION_AGE_MS) {
    await auth.api.signOut({ headers: await headers() });
    redirect("/login?next=/admin&reason=expired");
  }
  if (ADMIN_REQUIRE_2FA && !s.user.twoFactorEnabled && !opts.allowSetup) redirect("/admin/security");
  return s.user;
}

export async function requirePartner() {
  const s = await getSession();
  // a cookie without a live session = access ended (batch done, revoked or timed out)
  if (!s) redirect(getSessionCookie(await headers()) ? "/delivery/ended" : "/login?next=/delivery");
  const batches = await partnerBatches(s.user);
  if (!batches) redirect(s.user.role === "delivery" ? "/delivery/ended" : "/");
  return { user: s.user, batches };
}
