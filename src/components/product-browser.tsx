"use client";
import { useMemo, useState } from "react";
import { fromPrice, inStock, type ShopProduct } from "@/lib/shop-types";
import { ProductGrid } from "./catalog";
import { cx, EmptyState, Select } from "./ui";

type Sort = "relevance" | "price_asc" | "price_desc" | "name";

/** Client-side filters over an already-rendered list: filtered URLs stay out of the index. */
export function ProductBrowser({ products, facet }: { products: ShopProduct[]; facet?: "brand" | "category" }) {
  const [sort, setSort] = useState<Sort>("relevance");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const options = useMemo(() => {
    if (!facet) return [];
    const m = new Map<string, string>();
    products.forEach((p) => m.set(p[facet].slug, p[facet].name));
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [products, facet]);

  const list = useMemo(() => {
    let l = products.filter((p) => (!onlyInStock || inStock(p)) && (!facet || !picked.length || picked.includes(p[facet].slug)));
    const by: Record<Sort, ((a: ShopProduct, b: ShopProduct) => number) | null> = {
      relevance: (a, b) => Number(b.bestseller) - Number(a.bestseller) || Number(b.featured) - Number(a.featured),
      price_asc: (a, b) => fromPrice(a) - fromPrice(b),
      price_desc: (a, b) => fromPrice(b) - fromPrice(a),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    if (by[sort]) l = [...l].sort(by[sort]!);
    // available items first, without hiding the rest
    return [...l].sort((a, b) => Number(inStock(b)) - Number(inStock(a)));
  }, [products, onlyInStock, picked, sort, facet]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {options.length > 1 && (
          <div className="scrollbar-none -mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:w-auto md:flex-wrap md:px-0" role="group" aria-label={`Filter by ${facet}`}>
            {options.map(([slug, name]) => {
              const on = picked.includes(slug);
              return (
                <button
                  key={slug}
                  aria-pressed={on}
                  onClick={() => setPicked(on ? picked.filter((x) => x !== slug) : [...picked, slug])}
                  className={cx("h-9 shrink-0 rounded-full border px-3 text-sm font-semibold", on ? "border-burgundy-600 bg-burgundy-600 text-white" : "border-cream-300 bg-white text-ink-700")}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
        <label className="flex h-9 items-center gap-2 rounded-full border border-cream-300 bg-white px-3 text-sm font-semibold text-ink-700">
          <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} className="accent-burgundy-600" />
          In stock only
        </label>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort products" className="ml-auto !h-9 !w-auto rounded-full text-sm">
          <option value="relevance">Sort: Recommended</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="name">Name A–Z</option>
        </Select>
      </div>
      <p className="mb-3 text-sm text-ink-500" aria-live="polite">
        {list.length} product{list.length === 1 ? "" : "s"}
      </p>
      {list.length ? <ProductGrid products={list} /> : <EmptyState title="Nothing matches these filters" body="Try removing a filter." />}
    </div>
  );
}
