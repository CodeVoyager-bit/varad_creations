"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deliver, failDelivery, startBatch } from "@/app/actions/delivery";
import { rupees } from "@/lib/money";
import type { partnerView } from "@/server/delivery";
import type { Jsonify } from "@/lib/db";
import { PackArt } from "./product-card";
import { Badge, Button, cx, Icon, Input, Notice, Textarea } from "./ui";

type Stop = Jsonify<ReturnType<typeof partnerView>>;
export interface BatchView {
  id: string;
  code: string;
  status: string;
  stops: Stop[];
}

const DONE = ["delivered", "delivery_failed", "rescheduled", "cancelled"];

function directions(a: Stop["address"]) {
  const dest = a.lat != null ? `${a.lat},${a.lng}` : encodeURIComponent(`${a.flat}, ${a.building}, ${a.street}, ${a.city} ${a.pincode}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-label={title} onClose={onClose} onCancel={onClose}>
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-11 cursor-pointer place-items-center rounded-full bg-cream-200" aria-label="Close">
            <Icon name="close" className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function StopCard({ s, n }: { s: Stop; n: number }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<"deliver" | "fail" | null>(null);
  const [err, setErr] = useState("");
  const [method, setMethod] = useState<"cash" | "upi">("cash");
  const [pending, start] = useTransition();
  const [checked, setChecked] = useState<number[]>([]);
  const cod = s.amountToCollectPaise > 0;
  const done = DONE.includes(s.status);
  const submit = (fn: (fd: FormData) => Promise<{ ok: boolean; error?: string }>) => (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await fn(fd);
      if (!r.ok) return setErr(r.error ?? "Error");
      setSheet(null);
      router.refresh();
    });

  return (
    <li className={cx("rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]", done && "opacity-75")}>
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cream-200 text-sm font-bold text-ink-700">{n}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-lg font-semibold">{s.address.name}</p>
            {cod ? (
              <span className="text-right">
                <b className="block text-lg tabular-nums">{rupees(s.amountToCollectPaise)}</b>
                <Badge tone="warn">COD</Badge>
              </span>
            ) : (
              <Badge tone="good">{s.cod ? `Collected · ${s.cod.method}` : "Prepaid"}</Badge>
            )}
          </div>
          <p className="mt-1 flex gap-1.5 text-sm text-ink-700">
            <Icon name="pin" className="mt-0.5 size-4 shrink-0" />
            <span>
              {s.address.flat}, {s.address.building}, {s.address.street}
              {s.address.landmark ? `, near ${s.address.landmark}` : ""}, {s.address.city} {s.address.pincode}
            </span>
          </p>
          {s.address.instructions && <p className="mt-1 rounded-lg bg-saffron-50 px-2 py-1 text-sm text-saffron-700">“{s.address.instructions}”</p>}
          <p className="mt-1 text-xs text-ink-500">
            Order #{s.number} · {s.items.reduce((a, i) => a + i.qty, 0)} items
          </p>
        </div>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-burgundy-700">Package checklist</summary>
        <ul className="mt-2 space-y-1">
          {s.items.map((it, i) => (
            <li key={i}>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="size-5 accent-leaf-600" checked={checked.includes(i)} onChange={() => setChecked(checked.includes(i) ? checked.filter((x) => x !== i) : [...checked, i])} />
                <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-cream-50">
                  {it.image ? <Image src={it.image} alt="" fill sizes="40px" className="object-contain" /> : <PackArt name={it.name} brand={it.brand} className="size-full" />}
                </span>
                <span>
                  <b>{it.qty} ×</b> {it.brand} {it.name} ({it.variantLabel})
                </span>
              </label>
            </li>
          ))}
        </ul>
      </details>
      {s.status === "out_for_delivery" && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={directions(s.address)} target="_blank" rel="noopener" className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-burgundy-600/30 font-semibold text-burgundy-700">
              <Icon name="nav" /> Navigate
            </a>
            <a href={`tel:${s.address.phone}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-burgundy-600/30 font-semibold text-burgundy-700">
              <Icon name="phone" /> Call
            </a>
          </div>
          <Button size="lg" block className="mt-2 h-14" onClick={() => setSheet("deliver")}>
            {cod ? "Collect payment & mark delivered" : "Mark delivered"}
          </Button>
          <button className="mt-2 w-full py-2 text-sm font-semibold text-danger-600" onClick={() => setSheet("fail")}>
            Unable to deliver
          </button>
        </>
      )}
      {s.status === "delivered" && <p className="mt-3 text-sm font-semibold text-leaf-700">✓ Delivered</p>}
      {s.status === "delivery_failed" && <p className="mt-3 text-sm font-semibold text-danger-600">Not delivered — {s.attempts.at(-1)?.reason}. The shop will follow up.</p>}

      <Sheet open={sheet === "deliver"} onClose={() => setSheet(null)} title={`Deliver #${s.number}`}>
        <form action={submit((fd) => deliver(s.id, fd))} className="space-y-4">
          {cod ? (
            <>
              <p className="rounded-xl bg-saffron-50 p-3 text-center">
                Collect <b className="block text-3xl tabular-nums">{rupees(s.amountToCollectPaise)}</b>
              </p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Collected by">
                {(["cash", "upi"] as const).map((m) => (
                  <label key={m} className={cx("flex h-12 cursor-pointer items-center justify-center rounded-xl border-2 font-semibold", method === m ? "border-burgundy-600 bg-burgundy-50" : "border-cream-300")}>
                    <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                    {m === "cash" ? "Cash" : "UPI"}
                  </label>
                ))}
              </div>
              <input type="hidden" name="amount" value={(s.amountToCollectPaise / 100).toFixed(2)} />
              {method === "upi" && <Input name="reference" placeholder="UPI reference (optional)" />}
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" required className="mt-0.5 size-5 accent-leaf-600" /> I have collected {rupees(s.amountToCollectPaise)} {method === "cash" ? "in cash" : "by UPI"}
              </label>
            </>
          ) : (
            <Notice tone="good">Prepaid — do not collect any money.</Notice>
          )}
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="confirm" required className="mt-0.5 size-5 accent-leaf-600" /> The customer received all packages
          </label>
          <Textarea name="note" rows={2} placeholder="Note (optional)" maxLength={300} />
          {err && <Notice tone="bad">{err}</Notice>}
          <Button size="lg" block variant="success" disabled={pending}>
            {pending ? "Saving…" : "Confirm delivered"}
          </Button>
        </form>
      </Sheet>

      <Sheet open={sheet === "fail"} onClose={() => setSheet(null)} title="Unable to deliver">
        <form action={submit((fd) => failDelivery(s.id, fd))} className="space-y-3">
          <fieldset className="space-y-2">
            {["Customer not reachable", "Customer not at address", "Address incomplete / not found", "Customer refused delivery", "Customer asked to reschedule", "Payment not available (COD)", "Other"].map((r, i) => (
              <label key={r} className="flex h-11 items-center gap-3 rounded-xl border border-cream-300 px-3 text-sm">
                <input type="radio" name="reason" value={r} required defaultChecked={i === 0} className="accent-burgundy-600" /> {r}
              </label>
            ))}
          </fieldset>
          <Textarea name="note" rows={2} placeholder="What happened? (optional)" maxLength={300} />
          {err && <Notice tone="bad">{err}</Notice>}
          <Button size="lg" block variant="danger" disabled={pending}>
            {pending ? "Saving…" : "Record unsuccessful attempt"}
          </Button>
          <p className="text-xs text-ink-500">Bring the package back to the shop. The shop will contact the customer.</p>
        </form>
      </Sheet>
    </li>
  );
}

export function DeliveryHome({ batches, shopPhone }: { batches: BatchView[]; shopPhone: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const all = batches.flatMap((b) => b.stops);
  const done = all.filter((s) => DONE.includes(s.status));
  const cash = done.filter((s) => s.cod?.method === "cash").reduce((a, s) => a + (s.cod?.collectedPaise ?? 0), 0);
  const upi = done.filter((s) => s.cod?.method === "upi").reduce((a, s) => a + (s.cod?.collectedPaise ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-ink-900">My deliveries</h1>
        <a href={`tel:${shopPhone.replace(/\s/g, "")}`} className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-semibold shadow-sm">
          <Icon name="phone" className="size-4" /> Shop
        </a>
      </div>
      {batches.map((b) => {
        const total = b.stops.length;
        const n = b.stops.filter((s) => DONE.includes(s.status)).length;
        return (
          <div key={b.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="flex justify-between text-sm font-semibold">
              <span>Batch {b.code}</span>
              <span className="text-ink-500">
                {n} of {total} completed
              </span>
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-200" aria-hidden>
              <div className="h-full bg-leaf-600" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
            </div>
            {b.stops.some((s) => s.status === "ready_for_dispatch" || s.status === "rescheduled") && (
              <Button
                block
                size="lg"
                className="mt-3"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await startBatch(b.id);
                    if (!r.ok) return setErr(r.error);
                    router.refresh();
                  })
                }
              >
                I’ve picked up all packages — start deliveries
              </Button>
            )}
          </div>
        );
      })}
      {err && <Notice tone="bad">{err}</Notice>}
      <div className="grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm" role="tablist">
        {(["pending", "done"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("h-11 rounded-lg text-sm font-semibold", tab === t ? "bg-burgundy-600 text-white" : "text-ink-700")}>
            {t === "pending" ? `Pending (${all.length - done.length})` : `Completed (${done.length})`}
          </button>
        ))}
      </div>
      <ul className="space-y-3">
        {(tab === "pending" ? all.filter((s) => !DONE.includes(s.status)) : done).map((s) => (
          <StopCard key={s.id} s={s} n={all.indexOf(s) + 1} />
        ))}
      </ul>
      <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
        <p className="font-semibold">Collection summary</p>
        <p className="flex justify-between">
          <span>Cash collected</span>
          <b className="tabular-nums">{rupees(cash)}</b>
        </p>
        <p className="flex justify-between">
          <span>UPI collected</span>
          <b className="tabular-nums">{rupees(upi)}</b>
        </p>
        <p className="mt-1 text-xs text-ink-500">Hand over cash to the shop. The shop marks collections settled.</p>
      </div>
    </div>
  );
}
