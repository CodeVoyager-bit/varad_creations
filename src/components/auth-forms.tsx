"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { completeRegistration, startRegistration } from "@/app/actions/auth";
import { authClient } from "@/lib/auth-client";
import { Button, Field, Input, Notice } from "./ui";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : null);
const e164 = (ten: string) => `+91${ten}`;

function PhoneInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <Field label="Mobile number">
      <div className="flex">
        <span className="grid h-11 place-items-center rounded-l-xl border border-r-0 border-cream-300 bg-cream-100 px-3 text-sm font-semibold text-ink-700">+91</span>
        <Input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          required
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          className="rounded-l-none"
          placeholder="98XXXXXXXX"
        />
      </div>
    </Field>
  );
}

function PasswordInput(p: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={p.label} hint={p.hint}>
      <div className="relative">
        <Input type={show ? "text" : "password"} autoComplete={p.autoComplete} required minLength={8} maxLength={128} value={p.value} onChange={(e) => p.onChange(e.target.value)} className="pr-16" />
        <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs font-semibold text-burgundy-700">
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </Field>
  );
}

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const next = safeNext(sp.get("next"));

  const done = (role?: string) => {
    setPassword("");
    router.replace(next ?? (role === "admin" ? "/admin" : role === "delivery" ? "/delivery" : "/"));
    router.refresh();
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (needTotp) {
        const r = await authClient.twoFactor.verifyTotp({ code: totp.trim(), trustDevice: false });
        if (r.error) return setErr("That code didn't work. Check your authenticator app and try again.");
        return done("admin");
      }
      const r = await authClient.signIn.phoneNumber({ phoneNumber: e164(phone), password, rememberMe: true });
      if (r.error) return setErr(r.error.status === 429 ? "Too many attempts. Please wait a few minutes." : "Incorrect mobile number or password.");
      const data = r.data as { twoFactorRedirect?: boolean; user?: { role?: string } };
      if (data?.twoFactorRedirect) return setNeedTotp(true);
      done(data?.user?.role);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {sp.get("reason") === "expired" && <Notice tone="warn">For security, admin sessions expire after 12 hours. Please sign in again.</Notice>}
      {needTotp ? (
        <Field label="6-digit code from your authenticator app">
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))} />
        </Field>
      ) : (
        <>
          <PhoneInput value={phone} onChange={setPhone} autoFocus />
          <PasswordInput label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        </>
      )}
      {err && <Notice tone="bad">{err}</Notice>}
      <Button block size="lg" disabled={busy || (!needTotp && phone.length !== 10)}>
        {busy ? "Please wait…" : needTotp ? "Verify" : "Sign in"}
      </Button>
      {!needTotp && (
        <div className="flex justify-between text-sm">
          <Link href="/forgot-password" className="font-semibold text-burgundy-700 hover:underline">
            Forgot password?
          </Link>
          <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-burgundy-700 hover:underline">
            Create an account
          </Link>
        </div>
      )}
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [step, setStep] = useState<"phone" | "verify">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<{ text: string; exists?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await startRegistration(phone);
    setBusy(false);
    if (!r.ok) return setErr({ text: r.error });
    setStep("verify");
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await completeRegistration({ phone, code, name, password });
    setBusy(false);
    if (!r.ok) return setErr({ text: r.error, exists: r.exists });
    setPassword(""); // the route stays mounted (hidden) after navigation
    router.replace(safeNext(sp.get("next")) ?? "/");
    router.refresh();
  }

  if (step === "phone")
    return (
      <form onSubmit={send} className="space-y-4">
        <PhoneInput value={phone} onChange={setPhone} autoFocus />
        <p className="text-xs text-ink-500">We’ll send a one-time code (WhatsApp or SMS) to confirm this number is yours. You’ll sign in with your number and password afterwards.</p>
        {err && <Notice tone="bad">{err.text}</Notice>}
        <Button block size="lg" disabled={busy || phone.length !== 10}>
          {busy ? "Sending…" : "Send code"}
        </Button>
      </form>
    );
  return (
    <form onSubmit={finish} className="space-y-4">
      <Notice tone="info">Code sent to +91 {phone}.</Notice>
      <Field label="One-time code">
        <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <Field label="Your name">
        <Input autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <PasswordInput label="Create a password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." />
      {err && (
        <Notice tone="bad">
          {err.text}
          {err.exists && (
            <span className="mt-1 flex gap-3">
              <Link href="/login" className="font-semibold underline">
                Sign in
              </Link>
              <Link href="/forgot-password" className="font-semibold underline">
                Reset password
              </Link>
            </span>
          )}
        </Notice>
      )}
      <Button block size="lg" disabled={busy || code.length !== 6}>
        {busy ? "Creating account…" : "Verify & create account"}
      </Button>
      <button type="button" onClick={() => send()} disabled={busy} className="w-full text-sm font-semibold text-burgundy-700">
        Resend code
      </button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "reset" | "done">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(e?: React.FormEvent) {
    e?.preventDefault();
    setErr("");
    setBusy(true);
    const r = await authClient.phoneNumber.requestPasswordReset({ phoneNumber: e164(phone) });
    setBusy(false);
    if (r.error) return setErr(r.error.status === 429 ? "Too many requests. Please wait 10 minutes." : "Something went wrong. Please try again.");
    setStep("reset");
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const r = await authClient.phoneNumber.resetPassword({ phoneNumber: e164(phone), otp: otp.trim(), newPassword: password });
    setBusy(false);
    if (r.error) return setErr(r.error.status === 429 ? "Too many attempts. Please wait and request a new code." : "That code is incorrect or has expired.");
    setStep("done");
  }

  if (step === "done")
    return (
      <div className="space-y-4">
        <Notice tone="good" title="Password updated">
          Sign in with your new password.
        </Notice>
        <Button block size="lg" onClick={() => router.push("/login")}>
          Go to sign in
        </Button>
      </div>
    );
  if (step === "phone")
    return (
      <form onSubmit={request} className="space-y-4">
        <PhoneInput value={phone} onChange={setPhone} autoFocus />
        {err && <Notice tone="bad">{err}</Notice>}
        <Button block size="lg" disabled={busy || phone.length !== 10}>
          {busy ? "Please wait…" : "Send reset code"}
        </Button>
      </form>
    );
  return (
    <form onSubmit={reset} className="space-y-4">
      <Notice tone="info">If +91 {phone} has an account, a code is on its way.</Notice>
      <Field label="One-time code">
        <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <PasswordInput label="New password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." />
      {err && <Notice tone="bad">{err}</Notice>}
      <Button block size="lg" disabled={busy || otp.length !== 6}>
        {busy ? "Saving…" : "Set new password"}
      </Button>
      <button type="button" onClick={() => request()} disabled={busy} className="w-full text-sm font-semibold text-burgundy-700">
        Resend code
      </button>
    </form>
  );
}
