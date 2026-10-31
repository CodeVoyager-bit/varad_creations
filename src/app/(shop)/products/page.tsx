import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/catalog";
import { ProductBrowser } from "@/components/product-browser";
import { getCatalog, toCard } from "@/server/storefront";

export const metadata: Metadata = {
  title: "All products",
  description: "Browse branded Indori namkeen, snacks, bakery items and pickles, delivered across Pune and PCMC.",
  alternates: { canonical: "/products" },
};

export default async function ProductsPage() {
  const { products } = await getCatalog();
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "All products" }]} />
      <h1 className="mb-3 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink-900">All products</h1>
      <ProductBrowser products={products.filter((p) => p.status === "active").map(toCard)} facet="brand" />
    </div>
  );
}
