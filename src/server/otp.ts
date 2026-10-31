/**
 * OTP delivery for phone verification and password reset.
 *
 * Production: MiniMoth (https://minimoth.dev/docs). MiniMoth generates and checks the code;
 * Better Auth stays the only session authority — MiniMoth's own session tokens are discarded.
 * Development without MINIMOTH_API_KEY: Better Auth generates the code and it is printed to
 * the server console. Production without a key refuses to send instead of pretending.
 */
const API = "https://api.minimoth.dev/v1";
const key = process.env.MINIMOTH_API_KEY;
const isProd = process.env.NODE_ENV === "production";

export const otpMode: "minimoth" | "dev-console" | "unconfigured" = key ? "minimoth" : isProd ? "unconfigured" : "dev-console";

export class OtpSendError extends Error {}

export async function sendOtp(phone: string, devCode: string) {
  if (otpMode === "dev-console") {
    console.info(`\n[dev OTP] ${phone} → ${devCode}\n`);
    return;
  }
  if (otpMode === "unconfigured") throw new OtpSendError("OTP delivery is not configured (MINIMOTH_API_KEY missing).");
  const res = await fetch(`${API}/otp/send`, {
    method: "POST",
    headers: { "X-Api-Key": key!, "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
    // never log the phone number with the provider error
    console.error("[otp] MiniMoth send failed", res.status, body.code ?? body.error);
    throw new OtpSendError(res.status === 429 ? "Too many codes requested. Try again in 10 minutes." : "Could not send the code. Please try again.");
  }
}

/** Only used when MiniMoth is active (it owns the code). */
export async function verifyOtpWithProvider(phone: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  const res = await fetch(`${API}/otp/verify`, {
    method: "POST",
    headers: { "X-Api-Key": key!, "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  return res.ok;
}
