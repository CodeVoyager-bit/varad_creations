import Image from "next/image";
import Link from "next/link";
import type { ShopBrand, ShopCategory, ShopProduct } from "@/lib/shop-types";
import { ProductCard } from "./product-card";
import { Icon } from "./ui";

export function SectionHeader({ title, eyebrow, href, linkLabel = "See all" }: { title: string; eyebrow?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-0.5 text-[13px] font-medium text-ink-500">{eyebrow}</p>}
        <h2 className="font-display text-xl font-bold tracking-[-0.01em] text-ink-900 md:text-[1.375rem]">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg px-1 text-sm font-semibold text-burgundy-600 hover:text-burgundy-800">
          {linkLabel} <Icon name="chevron" className="size-4" />
        </Link>
      )}
    </div>
  );
}

/** Swipeable row on phones; on wider screens one tidy grid row of six (the rest sit behind "See all"). */
export function ProductRow({ title, eyebrow, href, products }: { title: string; eyebrow?: string; href?: string; products: ShopProduct[] }) {
  if (!products.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-4">
      <SectionHeader title={title} eyebrow={eyebrow} href={href} />
      <ul className="scrollbar-none -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-6 md:[&>li:nth-child(n+9)]:hidden lg:[&>li:nth-child(n+7)]:hidden">
        {products.slice(0, 12).map((p) => (
          <li key={p.id} className="w-[42%] shrink-0 snap-start sm:w-[29%] md:w-auto">
            <ProductCard p={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProductGrid({ products }: { products: ShopProduct[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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

/** Uploaded category photo > a real pack shot from the category > line icon. */
export function CategoryArt({ c }: { c: Pick<ShopCategory, "slug" | "name" | "image" | "packImage"> }) {
  if (c.image) return <Image src={c.image} alt="" fill sizes="120px" className="object-cover" />;
  if (c.packImage) return <Image src={c.packImage} alt="" fill sizes="120px" className="object-contain p-2 mix-blend-multiply" />;
  const d = ART[c.slug] ?? "M10 18 24 10l14 8v14l-14 8-14-8zM10 18l14 8 14-8M24 26v14";
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-full p-4 text-burgundy-600">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Empty categories are hidden: a tile that leads to "no products" is a dead end. */
export function CategoryTiles({ categories }: { categories: ShopCategory[] }) {
  return (
    <ul className="grid grid-cols-4 gap-x-2.5 gap-y-4 sm:grid-cols-6 lg:grid-cols-8">
      {categories
        .filter((c) => c.productCount !== 0)
        .map((c) => (
          <li key={c.id}>
            <Link href={`/c/${c.slug}`} className="group flex flex-col items-center gap-1.5 text-center">
              <span className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl bg-[var(--color-tile)] transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-[0.98] motion-reduce:transform-none">
                <CategoryArt c={c} />
              </span>
              <span className="line-clamp-2 text-xs font-semibold leading-tight text-ink-900 sm:text-[13px]">{c.name}</span>
            </Link>
          </li>
        ))}
    </ul>
  );
}

export function BrandCards({ brands, grid }: { brands: ShopBrand[]; grid?: boolean }) {
  return (
    <ul className={grid ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" : "scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-7"}>
      {brands
        .filter((b) => b.productCount !== 0)
        .map((b) => (
          <li key={b.id} className={grid ? undefined : "w-[7.5rem] shrink-0 md:w-auto"}>
            <Link href={`/b/${b.slug}`} className="group flex h-full flex-col items-center gap-2 rounded-2xl bg-white p-3 pb-3.5 text-center ring-1 ring-black/[0.06] transition-shadow hover:shadow-[0_12px_32px_-16px_rgb(36_23_15/0.35)]">
              <span className="relative grid aspect-[4/3] w-full place-items-center">
                {b.logo ? (
                  <Image src={b.logo} alt="" fill sizes="140px" className="object-contain p-1" />
                ) : b.packImage ? (
                  <Image src={b.packImage} alt="" fill sizes="140px" className="object-contain" />
                ) : (
                  <span className="font-display text-3xl font-bold text-burgundy-600">{b.name[0]}</span>
                )}
              </span>
              <span className="line-clamp-1 text-[13px] font-bold leading-tight text-ink-900">{b.name}</span>
              {b.productCount ? <span className="-mt-1.5 text-xs text-ink-500">{b.productCount} products</span> : null}
            </Link>
          </li>
        ))}
    </ul>
  );
}

/** Full brand directory. */
export function BrandChips({ brands }: { brands: ShopBrand[] }) {
  return <BrandCards brands={brands} grid />;
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
