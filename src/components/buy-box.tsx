"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { notifyWhenBack } from "@/app/actions/customer";
import { percentOff, rupees } from "@/lib/money";
import type { ShopProduct } from "@/lib/shop-types";
import Link from "next/link";
import { cart, qtyOf, useCart } from "./cart-store";
import { flyToCart } from "./fly-to-cart";
import { PackArt, PackMorph, Stepper } from "./product-card";
import { Badge, cx, Icon } from "./ui";

export function Gallery({ id, images, labels, name, brand }: { id: string; images: string[]; labels: string[]; name: string; brand: string }) {
  const all = [...images.map((src) => ({ src, alt: `${brand} ${name} pack` })), ...labels.map((src, i) => ({ src, alt: `${brand} ${name} label ${i + 1}` }))];
  const [i, setI] = useState(0);
  if (!all.length)
    return (
      <div>
        <div className="mx-auto aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-cream-300/70 sm:aspect-square">
          <PackArt name={name} brand={brand} className="size-full" />
        </div>
        <p className="mt-2 text-xs text-ink-500">Illustration — product and label photos will be added.</p>
      </div>
    );
  return (
    <div>
      <PackMorph id={id}>
        <div data-gallery className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[var(--color-tile)] sm:aspect-square">
          <Image key={all[i].src} src={all[i].src} alt={all[i].alt} fill priority sizes="(max-width:768px) 100vw, 520px" className="animate-[fade-in_300ms_ease-out] object-contain p-8 mix-blend-multiply" />
        </div>
      </PackMorph>
      {all.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto" aria-label="Product images">
          {all.map((im, k) => (
            <li key={im.src}>
              <button onClick={() => setI(k)} aria-current={k === i} aria-label={`Show image ${k + 1}`} className={cx("relative size-16 cursor-pointer overflow-hidden rounded-xl border-2 bg-[var(--color-tile)]", k === i ? "border-burgundy-600" : "border-cream-300")}>
                <Image src={im.src} alt={im.alt} fill sizes="64px" className="object-contain p-1 mix-blend-multiply" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BuyBox({ p, discontinued, whatsapp }: { p: ShopProduct; discontinued: boolean; whatsapp?: string }) {
  const [vid, setVid] = useState((p.variants.find((v) => v.inStock) ?? p.variants[0]).id);
  const v = p.variants.find((x) => x.id === vid)!;
  const off = percentOff(v.mrpPaise, v.pricePaise);
  return (
    <div className="space-y-4">
      {p.variants.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-700">Pack size</legend>
          <div className="flex flex-wrap gap-2">
            {p.variants.map((x) => (
              <label
                key={x.id}
                className={cx(
                  "cursor-pointer rounded-xl border-2 px-3 py-2 text-sm",
                  x.id === vid ? "border-burgundy-600 bg-burgundy-50" : "border-cream-300 bg-white",
                  !x.inStock && "opacity-60",
                )}
              >
                <input type="radio" name="variant" value={x.id} checked={x.id === vid} onChange={() => setVid(x.id)} className="sr-only" />
                <span className="block font-semibold">{x.label}</span>
                <span className="text-ink-500">{rupees(x.pricePaise)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-bold">{rupees(v.pricePaise)}</span>
          {off > 0 && (
            <>
              <span className="text-ink-500">
                MRP <s>{rupees(v.mrpPaise)}</s>
              </span>
              <Badge tone="good">{off}% below MRP</Badge>
            </>
          )}
        </p>
        <p className="text-xs text-ink-500">MRP inclusive of all taxes{v.unitPrice ? ` · Unit price ${v.unitPrice}` : ""}</p>
        {off > 0 && v.lowest30Paise != null && <p className="text-xs text-ink-500">Lowest price in the last 30 days: {rupees(v.lowest30Paise)}</p>}
      </div>
      {discontinued ? (
        <Badge tone="bad">Discontinued</Badge>
      ) : (
        <div className="space-y-2">
          <p className={cx("flex items-center gap-1.5 text-sm font-semibold", v.inStock ? "text-leaf-700" : "text-danger-600")}>
            <span aria-hidden className={cx("size-2 rounded-full", v.inStock ? "bg-leaf-600" : "bg-danger-600")} />
            {v.inStock ? (v.fewLeft ? `In stock — only ${v.fewLeft} left` : "In stock") : "Out of stock"}
          </p>
          <AddToCart p={p} v={v} />
          {!v.inStock && <NotifyMe key={v.id} variantId={v.id} slug={p.slug} />}
          {!v.inStock && whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hi! When will ${p.brand.name} ${p.name} (${v.label}) be back in stock?`)}`}
              target="_blank"
              rel="noopener"
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-leaf-600/40 bg-white px-4 font-semibold text-leaf-700 hover:bg-leaf-50 sm:max-w-sm"
            >
              <Icon name="whatsapp" className="size-5" /> Ask on WhatsApp when it’s back
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** Out of stock: leave a request the shop sees on its inventory page (signs in first if needed). */
function NotifyMe({ variantId, slug }: { variantId: string; slug: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  if (result?.ok)
    return (
      <p role="status" className="flex items-center gap-2 rounded-2xl bg-leaf-50 px-4 py-3 text-sm font-medium text-leaf-700 sm:max-w-sm">
        <Icon name="check" className="size-4" /> Done — we’ll message you when it’s back in stock.
      </p>
    );
  return (
    <div className="sm:max-w-sm">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await notifyWhenBack(variantId, slug)))}
        className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-burgundy-600 text-base font-semibold text-white transition-[transform,background-color] hover:bg-burgundy-700 active:scale-[0.99] disabled:opacity-60"
      >
        <Icon name="bell" className="size-5" />
        {pending ? "Saving…" : "Notify me when it’s back"}
      </button>
      {result && !result.ok && (
        <p role="alert" className="mt-2 text-sm text-danger-600">
          {result.error}
        </p>
      )}
    </div>
  );
}

/** Product page: one clear primary action; once added, a stepper and a path to the cart. */
function AddToCart({ p, v }: { p: ShopProduct; v: ShopProduct["variants"][number] }) {
  const qty = qtyOf(useCart(), v.id);
  if (!v.inStock) return null;
  if (!qty)
    return (
      <button
        onClick={() => {
          cart.setQty({ variantId: v.id, name: p.name, brand: p.brand.name, label: v.label, pricePaise: v.pricePaise, mrpPaise: v.mrpPaise, image: p.image, slug: p.slug }, 1);
          flyToCart(document.querySelector("[data-gallery] img"));
        }}
        className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-burgundy-600 text-base font-semibold text-white transition-[transform,background-color] hover:bg-burgundy-700 active:scale-[0.99] motion-reduce:active:scale-100 sm:max-w-sm"
      >
        Add to cart · {rupees(v.pricePaise)}
      </button>
    );
  return (
    <div className="flex animate-[pop_260ms_cubic-bezier(.3,1.5,.5,1)] items-center gap-3">
      <Stepper product={p} variant={v} />
      <Link href="/cart" className="inline-flex h-11 items-center rounded-xl px-4 font-semibold text-burgundy-700 ring-1 ring-burgundy-600/30 hover:bg-burgundy-50">
        View cart
      </Link>
    </div>
  );
}
