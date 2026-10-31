"use client";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, Field, Input, Notice } from "./ui";

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [backup, setBackup] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (enabled && !backup.length) return <Notice tone="good">Two-factor authentication is on.</Notice>;

  return (
    <div className="space-y-3">
      {!qr ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await authClient.twoFactor.enable({ password });
            if (r.error || !r.data || r.data.method !== "totp") return setMsg({ ok: false, text: "Password incorrect." });
            setQr(await QRCode.toDataURL(r.data.totpURI));
            setBackup(r.data.backupCodes);
            setPassword("");
          }}
        >
          <Field label="Confirm your password">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Button>Set up authenticator app</Button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await authClient.twoFactor.verifyTotp({ code });
            if (r.error) return setMsg({ ok: false, text: "Code didn't match. Check the time on your phone and try again." });
            setMsg({ ok: true, text: "Two-factor authentication is on. Store the backup codes safely." });
            router.refresh();
          }}
        >
          <p className="text-sm">Scan with Google Authenticator, Microsoft Authenticator or similar, then enter the 6-digit code.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Authenticator setup QR code" className="size-48 rounded-xl border border-cream-300" />
          <Field label="6-digit code">
            <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
          </Field>
          <Button>Verify & turn on</Button>
          <div className="rounded-xl bg-cream-100 p-3 text-sm">
            <p className="font-semibold">Backup codes (each works once if you lose your phone):</p>
            <p className="mt-1 font-mono text-xs">{backup.join("  ")}</p>
          </div>
        </form>
      )}
      {msg && <Notice tone={msg.ok ? "good" : "bad"}>{msg.text}</Notice>}
    </div>
  );
}
