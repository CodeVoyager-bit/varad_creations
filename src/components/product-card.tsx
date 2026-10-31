"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { rupees, percentOff } from "@/lib/money";
import { inStock, type ShopProduct, type ShopVariant } from "@/lib/shop-types";
import { cart, MAX_QTY, qtyOf, useCart } from "./cart-store";
import { cx, Icon } from "./ui";

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
  const h = size === "sm" ? "h-10" : "h-11";
  if (!variant.inStock)
    return <span className={cx(h, "inline-flex items-center rounded-xl bg-cream-200 px-3 text-xs font-semibold text-ink-500")}>Out of stock</span>;
  if (!qty)
    return (
      <button
        onClick={() => cart.setQty(line, 1)}
        className={cx(h, "min-w-[4.75rem] cursor-pointer rounded-xl border-[1.5px] border-burgundy-600 bg-white px-4 text-sm font-bold text-burgundy-700 transition-transform hover:bg-burgundy-50 active:scale-[0.97] motion-reduce:active:scale-100")}
        aria-label={`Add ${product.name} ${variant.label} to cart`}
      >
        ADD
      </button>
    );
  return (
    <div className={cx(h, "inline-flex min-w-[5.5rem] items-center justify-between rounded-xl bg-burgundy-600 text-white")} role="group" aria-label={`${product.name} ${variant.label} quantity`}>
      <button className="grid h-full w-10 cursor-pointer place-items-center rounded-l-xl active:bg-burgundy-700" onClick={() => cart.setQty(line, qty - 1)} aria-label="Decrease quantity">
        <Icon name="minus" className="size-4" />
      </button>
      <span className="min-w-5 text-center text-sm font-bold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button className="grid h-full w-10 cursor-pointer place-items-center rounded-r-xl active:bg-burgundy-700 disabled:opacity-40" onClick={() => cart.setQty(line, qty + 1)} disabled={qty >= MAX_QTY} aria-label="Increase quantity">
        <Icon name="plus" className="size-4" />
      </button>
    </div>
  );
}

function Price({ v }: { v: ShopVariant }) {
  const off = percentOff(v.mrpPaise, v.pricePaise);
  return (
    <div className="leading-tight tabular-nums">
      <span className="block text-base font-bold text-ink-900">{rupees(v.pricePaise)}</span>
      {off > 0 && (
        <span className="text-xs text-ink-500 line-through">
          <span className="sr-only">MRP </span>
          {rupees(v.mrpPaise)}
        </span>
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
  const off = percentOff(v0.mrpPaise, v0.pricePaise);
  return (
    <article className="group relative flex h-full flex-col rounded-2xl bg-white p-2 ring-1 ring-black/[0.06] transition-shadow duration-200 hover:shadow-[0_12px_32px_-16px_rgb(36_23_15/0.35)]">
      <div className="relative">
        <Link href={`/p/${p.slug}`} className="block rounded-xl" aria-label={`${p.brand.name} ${p.name}`}>
          <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--color-tile)]">
            <ProductImage p={p} className={cx(p.image && "p-3 mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.05] motion-reduce:transform-none", !inStock(p) && "opacity-50 grayscale")} />
            {off > 0 && <span className="absolute left-0 top-2.5 rounded-r-md bg-leaf-600 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-white">{off}% OFF</span>}
            {!inStock(p) && <span className="absolute inset-x-2 bottom-2 rounded-lg bg-ink-900/80 py-1 text-center text-xs font-semibold text-white">Out of stock</span>}
          </div>
        </Link>
        {inStock(p) && (
          <div className="absolute -bottom-3 right-1.5 drop-shadow-[0_4px_10px_rgb(36_23_15/0.18)]">
            {multi ? (
              <button
                onClick={() => ref.current?.showModal()}
                className={cx(
                  "h-10 min-w-[4.75rem] cursor-pointer rounded-xl px-3 text-sm font-bold transition-[transform,background-color] active:scale-[0.97] motion-reduce:active:scale-100",
                  inCart ? "bg-burgundy-600 text-white" : "border-[1.5px] border-burgundy-600 bg-white text-burgundy-700 hover:bg-burgundy-50",
                )}
                aria-haspopup="dialog"
              >
                {inCart ? `${inCart} added` : "ADD"}
                <span className="sr-only"> — choose pack size for {p.name}</span>
              </button>
            ) : (
              <Stepper product={p} variant={v0} size="sm" />
            )}
          </div>
        )}
      </div>
      <Link href={`/p/${p.slug}`} tabIndex={-1} className="mt-4 flex flex-1 flex-col px-1 pb-1">
        <span className="flex items-baseline gap-1.5 tabular-nums">
          <b className="text-[15px] font-bold text-ink-900">{rupees(v0.pricePaise)}</b>
          {off > 0 && <s className="text-xs text-ink-500">{rupees(v0.mrpPaise)}</s>}
        </span>
        <h3 className="mt-1 line-clamp-2 text-[13.5px] font-semibold leading-[1.3] text-ink-900">{p.name}</h3>
        <span className="mt-auto pt-1.5 text-xs text-ink-500">
          {multi ? `${p.variants.length} sizes` : v0.label} · {p.brand.name}
        </span>
        {v0.fewLeft && <span className="text-xs font-semibold text-saffron-700">Only {v0.fewLeft} left</span>}
      </Link>
      {multi && (
        <dialog ref={ref} className="sheet" aria-label={`Choose pack size for ${p.name}`} onClick={(e) => e.target === ref.current && ref.current?.close()}>
          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-ink-500">{p.brand.name}</p>
                <p className="font-display text-lg font-bold">{p.name}</p>
              </div>
              <button onClick={() => ref.current?.close()} className="grid size-11 cursor-pointer place-items-center rounded-full bg-cream-200 hover:bg-cream-300" aria-label="Close">
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
