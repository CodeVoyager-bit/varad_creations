import type { Metadata } from "next";
import { Breadcrumbs, PageMotion } from "@/components/catalog";
import { SavedView } from "@/components/shopper-extras";
import { getCatalog, toCard } from "@/server/storefront";

export const metadata: Metadata = { title: "Saved items", robots: { index: false } };

export default async function SavedPage() {
  const { products } = await getCatalog();
  return (
    <PageMotion>
      <div className="mx-auto max-w-6xl px-4 py-4">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Saved items" }]} />
        <h1 className="mb-3 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink-900">Saved items</h1>
        <SavedView products={products.filter((p) => p.status === "active").map(toCard)} />
      </div>
    </PageMotion>
  );
}
