import type { Metadata } from "next";
import { BrandChips, Breadcrumbs } from "@/components/catalog";
import { getCatalog } from "@/server/storefront";

export const metadata: Metadata = { title: "Brands", description: "Shop by brand: Agrawal 420, Mahendra, Chheda's and more, delivered in Pune and PCMC.", alternates: { canonical: "/brands" } };

export default async function BrandsPage() {
  const { brands } = await getCatalog();
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Brands" }]} />
      <h1 className="mb-4 font-display text-2xl font-semibold text-burgundy-700">Shop by brand</h1>
      <BrandChips brands={brands} />
    </div>
  );
}
