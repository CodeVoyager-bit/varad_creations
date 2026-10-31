"use client";
import Image from "next/image";
import { useState } from "react";
import { percentOff, rupees } from "@/lib/money";
import type { ShopProduct } from "@/lib/shop-types";
import { PackArt, Stepper } from "./product-card";
import { Badge, cx } from "./ui";

export function Gallery({ images, labels, name, brand }: { images: string[]; labels: string[]; name: string; brand: string }) {
  const all = [...images.map((src) => ({ src, alt: `${brand} ${name} pack` })), ...labels.map((src, i) => ({ src, alt: `${brand} ${name} label ${i + 1}` }))];
  const [i, setI] = useState(0);
  if (!all.length)
    return (
      <div>
        <div className="mx-auto aspect-[4/3] overflow-hidden rounded-2xl bg-white sm:aspect-square">
          <PackArt name={name} brand={brand} className="size-full" />
        </div>
        <p className="mt-2 text-xs text-ink-500">Illustration — product and label photos will be added.</p>
      </div>
    );
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white sm:aspect-square">
        <Image src={all[i].src} alt={all[i].alt} fill priority sizes="(max-width:768px) 100vw, 520px" className="object-contain" />
      </div>
      {all.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto" aria-label="Product images">
          {all.map((im, k) => (
            <li key={im.src}>
              <button onClick={() => setI(k)} aria-current={k === i} className={cx("relative size-16 overflow-hidden rounded-lg border-2 bg-white", k === i ? "border-burgundy-600" : "border-transparent")}>
                <Image src={im.src} alt={im.alt} fill sizes="64px" className="object-contain" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BuyBox({ p, discontinued }: { p: ShopProduct; discontinued: boolean }) {
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
        <div className="flex items-center gap-3">
          <Stepper product={p} variant={v} />
          <span className={cx("text-sm font-semibold", v.inStock ? "text-leaf-700" : "text-danger-600")}>
            {v.inStock ? (v.fewLeft ? `In stock — only ${v.fewLeft} left` : "In stock") : "Out of stock"}
          </span>
        </div>
      )}
    </div>
  );
}
