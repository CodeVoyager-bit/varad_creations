import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductBrowser } from "@/components/product-browser";
import { EmptyState, PageLoading } from "@/components/ui";
import { getCatalog, toCard } from "@/server/storefront";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <Suspense fallback={<PageLoading />}>
        <Results {...props} />
      </Suspense>
    </div>
  );
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s]/g, " ");

async function Results({ searchParams }: PageProps<"/search">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, 80);
  const { products, brands, categories } = await getCatalog();
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const hits = terms.length
    ? products.filter((p) => {
        const hay = norm(`${p.name} ${p.brand.name} ${p.category.name} ${p.tags.join(" ")}`);
        return p.status === "active" && terms.every((t) => hay.includes(t));
      })
    : [];
  const brandHits = terms.length ? brands.filter((b) => terms.every((t) => norm(b.name).includes(t))) : [];
  const catHits = terms.length ? categories.filter((c) => terms.every((t) => norm(c.name).includes(t))) : [];
  return (
    <>
      <h1 className="mb-3 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink-900">{q ? <>Results for “{q}”</> : "Search"}</h1>
      {(brandHits.length > 0 || catHits.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {brandHits.map((b) => (
            <Link key={b.id} href={`/b/${b.slug}`} className="rounded-full bg-burgundy-50 px-3 py-1.5 text-sm font-semibold text-burgundy-700">
              Brand: {b.name}
            </Link>
          ))}
          {catHits.map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`} className="rounded-full bg-saffron-50 px-3 py-1.5 text-sm font-semibold text-saffron-700">
              Category: {c.name}
            </Link>
          ))}
        </div>
      )}
      {hits.length ? (
        <ProductBrowser products={hits.map(toCard)} facet="brand" />
      ) : (
        <EmptyState
          title={q ? "No products found" : "What are you looking for?"}
          body={q ? "Check the spelling or try a brand name like “Agrawal 420”." : "Type a product or brand in the search box above."}
        />
      )}
    </>
  );
}
