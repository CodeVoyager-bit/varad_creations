"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { rupees, percentOff } from "@/lib/money";
import { inStock, type ShopProduct, type ShopVariant } from "@/lib/shop-types";
import { cart, MAX_QTY, qtyOf, useCart } from "./cart-store";
import { Badge, cx, Icon } from "./ui";

/** Stand-in pack illustration until real product photography is uploaded. */
export function PackArt({ name, brand, className }: { name: string; brand: string; className?: string }) {
  let h = 0;
  for (const ch of name + brand) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const hues = [8, 22, 35, 345, 140, 28];
  const hue = hues[h % hues.length];
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={`${brand} ${name} (illustration)`} className={className}>
      <rect width="120" height="120" fill={`hsl(${hue} 60% 95%)`} />
      <path d="M30 18h60l6 10-4 74H28l-4-74z" fill={`hsl(${hue} 70% 42%)`} />
      <path d="M30 18h60l6 10H24z" fill={`hsl(${hue} 70% 32%)`} />
      <rect x="34" y="40" width="52" height="34" rx="5" fill="#fffaf0" />
      <text x="60" y="54" textAnchor="middle" fontSize="7.5" fontWeight="700" fill={`hsl(${hue} 70% 28%)`} fontFamily="system-ui">
        {brand.slice(0, 14)}
      </text>
      <text x="60" y="66" textAnchor="middle" fontSize="7" fill="#4a3a2f" fontFamily="system-ui">
        {name.slice(0, 16)}
      </text>
      <circle cx="60" cy="88" r="7" fill="#f5a524" opacity=".9" />
    </svg>
  );
}

export function ProductImage({ p, sizes = "(max-width:640px) 45vw, 220px", className }: { p: Pick<ShopProduct, "image" | "name" | "brand">; sizes?: string; className?: string }) {
  return p.image ? (
    <Image src={p.image} alt={`${p.brand.name} ${p.name} pack`} fill sizes={sizes} className={cx("object-contain", className)} />
  ) : (
    <PackArt name={p.name} brand={p.brand.name} className={cx("size-full", className)} />
  );
}

export function Stepper({ product, variant, size = "md" }: { product: ShopProduct; variant: ShopVariant; size?: "sm" | "md" }) {
  const state = useCart();
  const qty = qtyOf(state, variant.id);
  const line = {
    variantId: variant.id,
    name: product.name,
    brand: product.brand.name,
    label: variant.label,
    pricePaise: variant.pricePaise,
    mrpPaise: variant.mrpPaise,
    image: product.image,
    slug: product.slug,
  };
  const h = size === "sm" ? "h-9" : "h-10";
  if (!variant.inStock)
    return <span className={cx(h, "inline-flex items-center rounded-xl bg-cream-200 px-3 text-xs font-semibold text-ink-500")}>Out of stock</span>;
  if (!qty)
    return (
      <button
        onClick={() => cart.setQty(line, 1)}
        className={cx(h, "min-w-20 rounded-xl border-2 border-burgundy-600 bg-white px-4 text-sm font-bold text-burgundy-700 hover:bg-burgundy-50")}
        aria-label={`Add ${product.name} ${variant.label} to cart`}
      >
        ADD
      </button>
    );
  return (
    <div className={cx(h, "inline-flex min-w-20 items-center justify-between rounded-xl bg-burgundy-600 text-white")} role="group" aria-label={`${product.name} ${variant.label} quantity`}>
      <button className="grid h-full w-9 place-items-center" onClick={() => cart.setQty(line, qty - 1)} aria-label="Decrease quantity">
        <Icon name="minus" className="size-4" />
      </button>
      <span className="min-w-5 text-center text-sm font-bold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button className="grid h-full w-9 place-items-center disabled:opacity-40" onClick={() => cart.setQty(line, qty + 1)} disabled={qty >= MAX_QTY} aria-label="Increase quantity">
        <Icon name="plus" className="size-4" />
      </button>
    </div>
  );
}

function Price({ v }: { v: ShopVariant }) {
  const off = percentOff(v.mrpPaise, v.pricePaise);
  return (
    <div className="leading-tight">
      <span className="font-bold text-ink-900">{rupees(v.pricePaise)}</span>
      {off > 0 && (
        <>
          <span className="ml-1 text-xs text-ink-500 line-through">
            <span className="sr-only">MRP </span>
            {rupees(v.mrpPaise)}
          </span>
          <span className="block text-[11px] font-semibold text-leaf-700">{off}% below MRP</span>
        </>
      )}
    </div>
  );
}

/** Multiple pack sizes open a compact bottom sheet built on native <dialog> (focus trap + Esc for free). */
export function ProductCard({ p }: { p: ShopProduct }) {
  const ref = useRef<HTMLDialogElement>(null);
  const state = useCart();
  const v0 = p.variants.find((v) => v.inStock) ?? p.variants[0];
  const multi = p.variants.length > 1;
  const inCart = p.variants.reduce((a, v) => a + qtyOf(state, v.id), 0);
  return (
    <article className="group relative flex flex-col rounded-2xl bg-white p-2.5 shadow-[var(--shadow-card)]">
      <Link href={`/p/${p.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-cream-50">
          <ProductImage p={p} />
          <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
            {p.isDemo && <Badge tone="neutral">Sample</Badge>}
            {!inStock(p) && <Badge tone="bad">Out of stock</Badge>}
            {v0.fewLeft && <Badge tone="warn">Only {v0.fewLeft} left</Badge>}
          </div>
        </div>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{p.brand.name}</p>
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-ink-900">{p.name}</h3>
      </Link>
      <p className="mb-2 text-xs text-ink-500">{multi ? `${p.variants.length} sizes · from ${v0.label}` : v0.label}</p>
      <div className="mt-auto flex items-end justify-between gap-2">
        <Price v={v0} />
        {multi ? (
          inStock(p) ? (
            <button
              onClick={() => ref.current?.showModal()}
              className={cx(
                "h-10 min-w-20 rounded-xl px-3 text-sm font-bold",
                inCart ? "bg-burgundy-600 text-white" : "border-2 border-burgundy-600 bg-white text-burgundy-700 hover:bg-burgundy-50",
              )}
              aria-haspopup="dialog"
            >
              {inCart ? `${inCart} added` : "ADD"}
              <span className="sr-only"> — choose pack size for {p.name}</span>
            </button>
          ) : (
            <Stepper product={p} variant={v0} />
          )
        ) : (
          <Stepper product={p} variant={v0} />
        )}
      </div>
      {multi && (
        <dialog ref={ref} className="sheet" aria-label={`Choose pack size for ${p.name}`} onClick={(e) => e.target === ref.current && ref.current?.close()}>
          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-ink-500">{p.brand.name}</p>
                <p className="font-display text-lg font-semibold">{p.name}</p>
              </div>
              <button onClick={() => ref.current?.close()} className="grid size-9 place-items-center rounded-full bg-cream-200" aria-label="Close">
                <Icon name="close" className="size-4" />
              </button>
            </div>
            <ul className="divide-y divide-cream-200">
              {p.variants.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{v.label}</p>
                    <Price v={v} />
                    {v.fewLeft && <p className="text-xs font-semibold text-saffron-700">Only {v.fewLeft} left</p>}
                  </div>
                  <Stepper product={p} variant={v} />
                </li>
              ))}
            </ul>
            <button onClick={() => ref.current?.close()} className="mt-3 h-12 w-full rounded-xl bg-burgundy-600 font-semibold text-white">
              Done
            </button>
          </div>
        </dialog>
      )}
    </article>
  );
}
