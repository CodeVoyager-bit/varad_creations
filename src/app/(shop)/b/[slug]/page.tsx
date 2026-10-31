import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs, JsonLd } from "@/components/catalog";
import { ProductBrowser } from "@/components/product-browser";
import { siteUrl } from "@/lib/site";
import { getCatalog, getRedirect, toCard } from "@/server/storefront";

// fully static so unknown slugs get a real 404 (or 308 to a renamed brand)
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const { brands } = await getCatalog();
  return brands.length ? brands.map((c) => ({ slug: c.slug })) : [{ slug: "_" }];
}

async function load(slug: string) {
  const { brands, products } = await getCatalog();
  const cat = brands.find((c) => c.slug === slug);
  if (!cat) {
    const to = await getRedirect(`/b/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }
  return { cat, products: products.filter((p) => p.brand.slug === slug && p.status === "active").map(toCard) };
}

export async function generateMetadata({ params }: PageProps<"/b/[slug]">): Promise<Metadata> {
  const { cat } = await load((await params).slug);
  return {
    title: cat.seo?.title ?? `${cat.name} — buy online in Pune & PCMC`,
    description: cat.seo?.description ?? cat.description ?? `${cat.name} snacks and namkeen delivered across Pune and PCMC within 48 hours of order confirmation.`,
    alternates: { canonical: `/b/${cat.slug}` },
  };
}

export default async function BrandPage({ params }: PageProps<"/b/[slug]">) {
  const { cat, products } = await load((await params).slug);
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
            { "@type": "ListItem", position: 2, name: "Brands", item: `${siteUrl}/brands` },
            { "@type": "ListItem", position: 3, name: cat.name, item: `${siteUrl}/b/${cat.slug}` },
          ],
        }}
      />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Brands", href: "/brands" }, { name: cat.name }]} />
      <h1 className="font-display text-2xl font-semibold text-burgundy-700">{cat.name}</h1>
      {cat.description && <p className="mt-1 max-w-2xl text-sm text-ink-500">{cat.description}</p>}
      <div className="mt-4">
        <ProductBrowser products={products} facet="category" />
      </div>
    </div>
  );
}
