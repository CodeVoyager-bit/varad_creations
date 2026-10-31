"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cancelMyOrder, createSupportRequest, respondToSubstitution, submitPayment } from "@/app/actions/customer";
import { ImagePicker } from "./image-picker";
import { Button, Field, Input, Notice, Select, Textarea } from "./ui";

export function Countdown({ until }: { until: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(until).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [until]);
  if (left == null) return null;
  if (!left) return <span className="font-semibold text-danger-600">Payment window ended</span>;
  const m = Math.floor(left / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  return (
    <span className="font-semibold tabular-nums" aria-live="off">
      {m}:{String(sec).padStart(2, "0")} left to pay
    </span>
  );
}

export function CopyText({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded-lg bg-cream-200 px-2 py-1 text-xs font-semibold text-ink-700"
      onClick={() => navigator.clipboard?.writeText(text).then(() => (setDone(true), setTimeout(() => setDone(false), 1500)))}
      aria-label={`Copy ${label}`}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export function PaymentForm({ orderId, existingRef }: { orderId: string; existingRef?: string }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          setErr("");
          fd.set("orderId", orderId);
          const r = await submitPayment(fd);
          if (!r.ok) return setErr(r.error);
          router.refresh();
        })
      }
      className="space-y-3"
    >
      <Field label="UPI transaction ID / UTR" hint="12-digit number shown in your UPI app after paying.">
        <Input name="reference" required minLength={6} maxLength={35} defaultValue={existingRef} autoComplete="off" inputMode="text" />
      </Field>
      <div>
        <span className="mb-1 block text-sm font-medium text-ink-700">Payment screenshot (optional)</span>
        <ImagePicker name="proof" label="Add screenshot" hint="Visible only to the shop · up to 5 MB" />
      </div>
      {err && <Notice tone="bad">{err}</Notice>}
      <Button block disabled={pending}>
        {pending ? "Submitting…" : "I've paid — submit for verification"}
      </Button>
      <p className="text-xs text-ink-500">Submitting doesn’t confirm payment. We check our account and confirm your order once the money is received.</p>
    </form>
  );
}

export function CancelOrder({ orderId }: { orderId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("Changed my mind");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="secondary" onClick={() => ref.current?.showModal()}>
        Cancel order
      </Button>
      <dialog ref={ref} className="sheet" aria-label="Cancel order">
        <div className="space-y-3 p-5">
          <h2 className="font-display text-xl font-semibold">Cancel this order?</h2>
          <Field label="Reason">
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {["Changed my mind", "Ordered by mistake", "Want to change items or address", "Delivery time doesn't suit me", "Other"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          {err && <Notice tone="bad">{err}</Notice>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => ref.current?.close()}>
              Keep order
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelMyOrder(orderId, reason);
                  if (!r.ok) return setErr(r.error);
                  ref.current?.close();
                  router.refresh();
                })
              }
            >
              {pending ? "Cancelling…" : "Yes, cancel"}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

export function SubstitutionDecision({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const decide = (approve: boolean) =>
    start(async () => {
      const r = await respondToSubstitution(orderId, approve);
      if (!r.ok) return setErr(r.error);
      router.refresh();
    });
  return (
    <div className="space-y-2">
      {err && <Notice tone="bad">{err}</Notice>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" disabled={pending} onClick={() => decide(false)}>
          Decline
        </Button>
        <Button variant="success" className="flex-1" disabled={pending} onClick={() => decide(true)}>
          Approve changes
        </Button>
      </div>
    </div>
  );
}

const TOPICS: [string, string][] = [
  ["wrong_item", "Wrong item received"],
  ["damaged", "Damaged or leaking pack"],
  ["expired", "Expired or near-expiry product"],
  ["missing", "Item missing"],
  ["cancellation", "Cancel after packing started"],
  ["payment", "Payment or refund question"],
  ["other", "Something else"],
];

export function SupportForm({ orderId, topics = TOPICS }: { orderId?: string; topics?: [string, string][] }) {
  const router = useRouter();
  const [topic, setTopic] = useState(topics[0][0]);
  const [message, setMessage] = useState("");
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createSupportRequest({ orderId, topic: topic as "other", message });
          if (!r.ok) return setRes({ ok: false, text: r.error });
          setRes({ ok: true, text: `Request ${r.ticket} received. We acknowledge requests within 48 hours.` });
          setMessage("");
          router.refresh();
        });
      }}
    >
      <Field label="What's the issue?">
        <Select value={topic} onChange={(e) => setTopic(e.target.value)}>
          {topics.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Details">
        <Textarea required minLength={5} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what happened. For damaged or wrong items, keep the pack until we respond." />
      </Field>
      {res && <Notice tone={res.ok ? "good" : "bad"}>{res.text}</Notice>}
      <Button variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
