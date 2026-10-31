import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs, JsonLd } from "@/components/catalog";
import { ProductBrowser } from "@/components/product-browser";
import { siteUrl } from "@/lib/site";
import { getCatalog, getRedirect, toCard } from "@/server/storefront";

// fully static so unknown slugs get a real 404 (or 308 to a renamed category)
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const { categories } = await getCatalog();
  return categories.length ? categories.map((c) => ({ slug: c.slug })) : [{ slug: "_" }];
}

async function load(slug: string) {
  const { categories, products } = await getCatalog();
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) {
    const to = await getRedirect(`/c/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }
  return { cat, products: products.filter((p) => p.category.slug === slug && p.status === "active").map(toCard) };
}

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { cat } = await load((await params).slug);
  return {
    title: cat.seo?.title ?? `${cat.name} — buy online in Pune & PCMC`,
    description: cat.seo?.description ?? cat.description ?? `Branded ${cat.name.toLowerCase()} delivered across Pune and PCMC within 48 hours of order confirmation.`,
    alternates: { canonical: `/c/${cat.slug}` },
  };
}

export default async function CategoryPage({ params }: PageProps<"/c/[slug]">) {
  const { cat, products } = await load((await params).slug);
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
            { "@type": "ListItem", position: 2, name: "Categories", item: `${siteUrl}/categories` },
            { "@type": "ListItem", position: 3, name: cat.name, item: `${siteUrl}/c/${cat.slug}` },
          ],
        }}
      />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Categories", href: "/categories" }, { name: cat.name }]} />
      <h1 className="font-display text-[1.75rem] font-extrabold tracking-[-0.02em] text-ink-900">{cat.name}</h1>
      {cat.description && <p className="mt-1 max-w-2xl text-sm text-ink-500">{cat.description}</p>}
      <div className="mt-4">
        <ProductBrowser products={products} facet="brand" />
      </div>
    </div>
  );
}
