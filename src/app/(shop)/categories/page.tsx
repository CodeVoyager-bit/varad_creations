import type { Metadata } from "next";
import { Breadcrumbs, CategoryTiles } from "@/components/catalog";
import { getCatalog } from "@/server/storefront";

export const metadata: Metadata = { title: "Categories", description: "Shop namkeen, bakery, pickles, fasting snacks and more by category.", alternates: { canonical: "/categories" } };

export default async function CategoriesPage() {
  const { categories } = await getCatalog();
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Categories" }]} />
      <h1 className="mb-4 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink-900">Shop by category</h1>
      <CategoryTiles categories={categories} />
    </div>
  );
}
