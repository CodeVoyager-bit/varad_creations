"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { placeOrderAction } from "@/app/actions/customer";
import { rupees } from "@/lib/money";
import { AddressForm, type SavedAddress } from "./address-form";
import { BillSummary, FreeDeliveryBar, useQuote } from "./cart-view";
import { cart } from "./cart-store";
import { Button, ButtonLink, cx, EmptyState, Notice, Textarea } from "./ui";

export function CheckoutView({ addresses, user, windowHours, upiMinutes, upiReady }: { addresses: SavedAddress[]; user: { name: string; phone?: string }; windowHours: number; upiMinutes: number; upiReady: boolean }) {
  const router = useRouter();
  const { s, q, error, retry, pending: quoting } = useQuote();
  const [addressId, setAddressId] = useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id);
  const [adding, setAdding] = useState(addresses.length === 0);
  const [method, setMethod] = useState<"upi" | "cod">(upiReady ? "upi" : "cod");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [placing, start] = useTransition();
  // one key per checkout visit: retries and double taps reuse it, so only one order is created
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  if (!s.lines.length) return <EmptyState title="Your cart is empty" action={<ButtonLink href="/products">Start shopping</ButtonLink>} />;

  const issues = q?.lines.some((l) => l.issue) || (q?.quote.coupon && !q.quote.coupon.ok);

  function place() {
    if (!q || !addressId) return;
    setErr("");
    start(async () => {
      const r = await placeOrderAction({
        idempotencyKey,
        items: s.lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        couponCode: s.coupon,
        addressId,
        paymentMethod: method,
        expectedTotalPaise: q.quote.totalPaise,
        customerNote: note || undefined,
      });
      if (!r.ok) {
        setErr(r.error);
        if (["price_changed", "cart_changed", "coupon"].includes(r.code ?? "")) retry();
        return;
      }
      cart.clear();
      router.replace(`/orders/${r.orderId}?placed=1`);
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_360px] md:items-start">
      <div className="space-y-4">
        <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 font-semibold">1. Delivery address</h2>
          {!adding && (
            <div className="space-y-2">
              {addresses.map((a) => (
                <label key={a.id} className={cx("flex cursor-pointer gap-3 rounded-xl border-2 p-3", a.id === addressId ? "border-burgundy-600 bg-burgundy-50/50" : "border-cream-200")}>
                  <input type="radio" name="address" className="mt-1 accent-burgundy-600" checked={a.id === addressId} onChange={() => setAddressId(a.id)} />
                  <span className="text-sm">
                    <b>{a.label}</b> · {a.name}, {a.phone}
                    <span className="block text-ink-700">
                      {a.flat}, {a.building}, {a.street}
                      {a.landmark ? `, near ${a.landmark}` : ""}, {a.city} {a.pincode}
                    </span>
                  </span>
                </label>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
                + Add a new address
              </Button>
            </div>
          )}
          {adding && (
            <AddressForm
              defaultName={user.name}
              defaultPhone={user.phone}
              onCancel={addresses.length ? () => setAdding(false) : undefined}
              onSaved={(id) => {
                setAddressId(id);
                setAdding(false);
                router.refresh(); // server re-sends the saved list
              }}
            />
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 font-semibold">2. Payment method</h2>
          <div className="space-y-2">
            <label className={cx("flex gap-3 rounded-xl border-2 p-3", method === "upi" ? "border-burgundy-600 bg-burgundy-50/50" : "border-cream-200", upiReady ? "cursor-pointer" : "opacity-60")}>
              <input type="radio" name="pay" className="mt-1 accent-burgundy-600" disabled={!upiReady} checked={method === "upi"} onChange={() => setMethod("upi")} />
              <span className="text-sm">
                <b>UPI</b> (any UPI app){!upiReady && " — temporarily unavailable"}
                <span className="block text-ink-500">
                  After placing the order you’ll see our UPI QR and payment link. Pay within {upiMinutes} minutes and enter your UPI transaction ID. We confirm your order once we see the payment in our account.
                </span>
              </span>
            </label>
            <label className={cx("flex cursor-pointer gap-3 rounded-xl border-2 p-3", method === "cod" ? "border-burgundy-600 bg-burgundy-50/50" : "border-cream-200")}>
              <input type="radio" name="pay" className="mt-1 accent-burgundy-600" checked={method === "cod"} onChange={() => setMethod("cod")} />
              <span className="text-sm">
                <b>Cash on delivery</b>
                <span className="block text-ink-500">Pay {q ? rupees(q.quote.totalPaise) : "the order total"} in cash or by UPI to our delivery partner. No extra COD fee.</span>
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-2 font-semibold">3. Note for the shop (optional)</h2>
          <Textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything we should know about this order?" />
        </section>
      </div>

      <aside className="space-y-3 md:sticky md:top-28">
        {q && <FreeDeliveryBar q={q} />}
        <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-2 font-semibold">Order summary</h2>
          <ul className="mb-3 space-y-1 text-sm">
            {s.lines.map((l) => (
              <li key={l.variantId} className="flex justify-between gap-2">
                <span className="truncate">
                  {l.qty} × {l.name} <span className="text-ink-500">({l.label})</span>
                </span>
                <span className="tabular-nums">{rupees(l.qty * l.pricePaise)}</span>
              </li>
            ))}
          </ul>
          {error ? (
            <Notice tone="bad">
              Couldn’t load prices.{" "}
              <button className="underline" onClick={retry}>
                Retry
              </button>
            </Notice>
          ) : q ? (
            <BillSummary q={q} />
          ) : (
            <div className="h-28 animate-pulse rounded-xl bg-cream-100" />
          )}
        </section>
        {issues && <Notice tone="warn">Some items or the coupon need attention. Please go back to your cart.</Notice>}
        {err && <Notice tone="bad">{err}</Notice>}
        <p className="text-xs text-ink-500">
          Delivery within {windowHours} hours of order confirmation. {method === "upi" ? "For UPI, confirmation follows payment verification." : "COD orders are confirmed by the shop after you place them."}
        </p>
        {/* stays reachable above the bottom nav on phones */}
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+var(--safe-bottom))] z-20 border-t border-cream-300 bg-cream-50/95 px-4 py-2 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
          <Button size="lg" block onClick={place} disabled={placing || quoting || !q || !addressId || adding || !!issues}>
            {placing ? "Placing order…" : q ? `Place order · ${rupees(q.quote.totalPaise)}` : "Place order"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
