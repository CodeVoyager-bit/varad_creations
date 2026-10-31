"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Notice, Spinner } from "./ui";

/**
 * The token sits in the URL fragment, which browsers never send to servers or put in logs.
 * It is posted once, then removed from the address bar. The resulting session is a normal
 * Better Auth session limited to one batch.
 */
export function InviteRedeem() {
  const router = useRouter();
  const [state, setState] = useState<"working" | "error" | "missing">("working");
  const [msg, setMsg] = useState("");
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const token = window.location.hash.slice(1);
    history.replaceState(null, "", window.location.pathname);
    if (!token) return void Promise.resolve().then(() => setState("missing"));
    fetch("/api/auth/delivery-invite/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), credentials: "include" })
      .then(async (r) => {
        if (r.ok) return router.replace("/delivery");
        const j = await r.json().catch(() => ({}));
        setMsg(r.status === 429 ? "Too many attempts. Wait a minute and ask the shop for a new link." : (j.message ?? "This link has expired or was already used."));
        setState("error");
      })
      .catch(() => {
        setMsg("No connection. Check your internet and ask the shop to resend the link.");
        setState("error");
      });
  }, [router]);
  return (
    <div className="space-y-4 pt-10 text-center">
      <h1 className="font-display text-2xl font-semibold text-burgundy-700">Varad Creation deliveries</h1>
      {state === "working" && <Spinner label="Opening your deliveries…" />}
      {state === "missing" && <Notice tone="warn">Open the link exactly as the shop sent it.</Notice>}
      {state === "error" && (
        <>
          <Notice tone="bad">{msg}</Notice>
          <p className="text-sm text-ink-500">Already opened it on this phone? Your deliveries may still be available.</p>
          <Button onClick={() => router.replace("/delivery")}>Go to my deliveries</Button>
        </>
      )}
    </div>
  );
}
