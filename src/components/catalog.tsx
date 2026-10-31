import Image from "next/image";
import Link from "next/link";
import type { ShopBrand, ShopCategory, ShopProduct } from "@/lib/shop-types";
import { ProductCard } from "./product-card";
import { SectionTitle } from "./ui";

export function ProductRow({ title, href, products }: { title: string; href?: string; products: ShopProduct[] }) {
  if (!products.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-4">
      <SectionTitle title={title} href={href} />
      <ul className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-5">
        {products.map((p) => (
          <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[30%] md:w-auto">
            <ProductCard p={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProductGrid({ products }: { products: ShopProduct[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard p={p} />
        </li>
      ))}
    </ul>
  );
}

const ART: Record<string, string> = {
  namkeen: "M8 26c2 9 30 9 32 0zM12 26c0-5 4-8 6-8s3 4 6 4 4-5 7-5 5 4 5 9",
  bakery: "M10 20a14 10 0 0 1 28 0v8H10zM16 20h.01M24 17h.01M31 21h.01",
  pickles: "M16 12h16v4H16zM14 16h20v20a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3zM18 26c3-3 9-3 12 0",
  fasting: "M24 38c-8-6-11-14-6-24 4 6 10 8 12 14 1 4-1 8-6 10zM24 38V22",
  sweets: "M10 30h28l-3 6H13zM14 30c0-6 4-10 10-10s10 4 10 10M18 22l2-6M28 22l-2-6",
};

export function CategoryArt({ c }: { c: Pick<ShopCategory, "slug" | "name" | "image"> }) {
  if (c.image) return <Image src={c.image} alt="" fill sizes="80px" className="object-cover" />;
  const d = ART[c.slug] ?? "M10 18 24 10l14 8v14l-14 8-14-8zM10 18l14 8 14-8M24 26v14";
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-full p-3 text-burgundy-600">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CategoryTiles({ categories, row }: { categories: ShopCategory[]; row?: boolean }) {
  return (
    <ul className={row ? "scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-6 sm:px-0 lg:grid-cols-8" : "grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8"}>
      {categories.map((c) => (
        <li key={c.id} className={row ? "w-[22%] shrink-0 sm:w-auto" : undefined}>
          <Link href={`/c/${c.slug}`} className="group flex flex-col items-center gap-1.5 text-center">
            <span className="relative grid aspect-square w-full max-w-20 place-items-center overflow-hidden rounded-full bg-saffron-50 ring-1 ring-saffron-100 transition group-hover:ring-saffron-400">
              <CategoryArt c={c} />
            </span>
            <span className="text-xs font-semibold text-ink-900 sm:text-sm">{c.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BrandChips({ brands }: { brands: ShopBrand[] }) {
  return (
    <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      {brands.map((b) => (
        <li key={b.id} className="shrink-0">
          <Link href={`/b/${b.slug}`} className="flex h-12 items-center gap-2 rounded-full border border-cream-300 bg-white px-4 text-sm font-bold text-burgundy-700 shadow-sm hover:border-burgundy-500">
            {b.logo && <Image src={b.logo} alt="" width={28} height={28} className="size-7 rounded-full object-contain" />}
            {b.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-xs text-ink-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>›</span>}
            {it.href ? (
              <Link href={it.href} className="hover:text-burgundy-700 hover:underline">
                {it.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink-700">
                {it.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
