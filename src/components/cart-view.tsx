"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { quoteCart, type CartQuote } from "@/app/actions/public";
import { rupees } from "@/lib/money";
import { cart, MAX_QTY, useCart, type CartLine } from "./cart-store";
import { PackArt } from "./product-card";
import { Button, ButtonLink, cx, EmptyState, Icon, Input, Notice } from "./ui";

/** Server quote for the current cart; refetches when lines or coupon change. */
export function useQuote() {
  const s = useCart();
  const [q, setQ] = useState<CartQuote | null>(null);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const key = JSON.stringify([s.lines.map((l) => [l.variantId, l.qty]), s.coupon]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!s.lines.length) return;
    const t = setTimeout(
      () =>
        start(async () => {
          try {
            const r = await quoteCart(
              s.lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
              s.coupon,
            );
            setQ(r);
            setError(!r);
          } catch {
            setError(true);
          }
        }),
      250,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
  return { s, q: s.lines.length ? q : null, pending, error, retry: () => setTick((x) => x + 1) };
}

export function BillSummary({ q }: { q: CartQuote }) {
  const b = q.quote;
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between">
        <dt className="text-ink-700">Item total (MRP-inclusive prices)</dt>
        <dd className="tabular-nums">{rupees(b.subtotalPaise)}</dd>
      </div>
      {b.discountPaise > 0 && (
        <div className="flex justify-between text-leaf-700">
          <dt>Coupon {b.coupon?.code}</dt>
          <dd className="tabular-nums">−{rupees(b.discountPaise)}</dd>
        </div>
      )}
      {b.discountPaise > 0 && (
        <div className="flex justify-between">
          <dt className="text-ink-700">Subtotal after discount</dt>
          <dd className="tabular-nums">{rupees(b.discountedSubtotalPaise)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-ink-700">Delivery fee</dt>
        <dd className="tabular-nums">{b.deliveryFeePaise ? rupees(b.deliveryFeePaise) : <span className="font-semibold text-leaf-700">FREE</span>}</dd>
      </div>
      <div className="flex justify-between border-t border-cream-200 pt-2 text-base font-bold">
        <dt>To pay</dt>
        <dd className="tabular-nums">{rupees(b.totalPaise)}</dd>
      </div>
      <p className="text-xs text-ink-500">No handling, packing or platform fees. {b.deliveryFeePaise ? `Delivery is free when the subtotal after discount is ${rupees(q.freeAbovePaise)} or more.` : ""}</p>
    </dl>
  );
}

export function FreeDeliveryBar({ q }: { q: CartQuote }) {
  const left = q.quote.freeDeliveryRemainingPaise;
  const pct = Math.min(100, Math.round((q.quote.discountedSubtotalPaise / q.freeAbovePaise) * 100));
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <p className="text-sm font-medium">
        {left > 0 ? (
          <>
            Add <b>{rupees(left)}</b> more (after discounts) for <b>free delivery</b>
          </>
        ) : (
          <span className="text-leaf-700">🎉 You’ve unlocked free delivery</span>
        )}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-200" aria-hidden>
        <div className="h-full rounded-full bg-leaf-600 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LineRow({ l, issue }: { l: CartLine; issue?: { kind: "unavailable" | "insufficient"; available: number } }) {
  return (
    <li className="flex gap-3 py-3">
      <Link href={`/p/${l.slug}`} className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-cream-50">
        {l.image ? <Image src={l.image} alt="" fill sizes="64px" className="object-contain" /> : <PackArt name={l.name} brand={l.brand} className="size-full" />}
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase text-ink-500">{l.brand}</p>
        <p className="truncate font-semibold">{l.name}</p>
        <p className="text-xs text-ink-500">{l.label}</p>
        {issue?.kind === "unavailable" && <p className="mt-1 text-xs font-semibold text-danger-600">Currently unavailable — remove to continue</p>}
        {issue?.kind === "insufficient" && (
          <button className="mt-1 text-xs font-semibold text-saffron-700 underline" onClick={() => cart.setQty(l, issue.available)}>
            Only {issue.available} available — update quantity
          </button>
        )}
      </div>
      <div className="flex flex-col items-end justify-between gap-2">
        <span className="font-semibold tabular-nums">{rupees(l.pricePaise * l.qty)}</span>
        <div className="inline-flex h-9 items-center rounded-xl bg-burgundy-600 text-white" role="group" aria-label={`${l.name} quantity`}>
          <button className="grid h-full w-9 place-items-center" onClick={() => cart.setQty(l, l.qty - 1)} aria-label="Decrease quantity">
            <Icon name="minus" className="size-4" />
          </button>
          <span className="min-w-5 text-center text-sm font-bold tabular-nums">{l.qty}</span>
          <button className="grid h-full w-9 place-items-center disabled:opacity-40" disabled={l.qty >= MAX_QTY} onClick={() => cart.setQty(l, l.qty + 1)} aria-label="Increase quantity">
            <Icon name="plus" className="size-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

export function CartView() {
  const { s, q, pending, error, retry } = useQuote();
  const [code, setCode] = useState("");
  // keep display snapshots in sync with server prices
  useEffect(() => {
    q?.lines.forEach((sv) => {
      const local = cart.get().lines.find((l) => l.variantId === sv.variantId);
      if (local && local.pricePaise !== sv.unitPricePaise) cart.setQty({ ...local, pricePaise: sv.unitPricePaise, mrpPaise: sv.mrpPaise }, local.qty);
    });
  }, [q]);
  if (!s.lines.length)
    return <EmptyState title="Your cart is empty" body="Browse our Indori favourites and add a few packs." action={<ButtonLink href="/products">Start shopping</ButtonLink>} />;

  const issues = new Map(q?.lines.filter((l) => l.issue).map((l) => [l.variantId, { kind: l.issue!, available: l.available }]));
  const blocked = !q || issues.size > 0 || (q.quote.coupon && !q.quote.coupon.ok);
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_360px] md:items-start">
      <div className="space-y-3">
        {q && <FreeDeliveryBar q={q} />}
        <section className="rounded-2xl bg-white px-4 shadow-[var(--shadow-card)]">
          <ul className="divide-y divide-cream-200">
            {s.lines.map((l) => (
              <LineRow key={l.variantId} l={l} issue={issues.get(l.variantId)} />
            ))}
          </ul>
        </section>
      </div>
      <aside className="space-y-3 md:sticky md:top-28">
        <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-2 font-semibold">Coupon</h2>
          {s.coupon ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-saffron-700">{s.coupon}</p>
                {q?.quote.coupon && <p className={cx("text-xs", q.quote.coupon.ok ? "text-leaf-700" : "text-danger-600")}>{q.quote.coupon.ok ? `You save ${rupees(q.quote.coupon.discountPaise)}` : q.quote.coupon.reason}</p>}
              </div>
              <button className="text-sm font-semibold text-burgundy-700" onClick={() => cart.setCoupon(undefined)}>
                Remove
              </button>
            </div>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                cart.setCoupon(code);
                setCode("");
              }}
            >
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter coupon code" aria-label="Coupon code" maxLength={40} />
              <Button variant="secondary" disabled={!code.trim()}>
                Apply
              </Button>
            </form>
          )}
          <p className="mt-2 text-xs text-ink-500">One coupon per order.</p>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]" aria-busy={pending}>
          <h2 className="mb-2 font-semibold">Bill details</h2>
          {error ? (
            <Notice tone="bad">
              Couldn’t load the latest prices.{" "}
              <button className="font-semibold underline" onClick={retry}>
                Retry
              </button>
            </Notice>
          ) : q ? (
            <BillSummary q={q} />
          ) : (
            <div className="h-28 animate-pulse rounded-xl bg-cream-100" />
          )}
        </section>
        <ButtonLink href={q?.signedIn ? "/checkout" : "/login?next=/checkout"} size="lg" block aria-disabled={blocked} className={cx(blocked && "pointer-events-none opacity-50")}>
          {q?.signedIn ? "Proceed to checkout" : "Sign in to checkout"}
        </ButtonLink>
        {!q?.signedIn && <p className="text-center text-xs text-ink-500">Your cart is saved on this device while you sign in.</p>}
      </aside>
    </div>
  );
}
