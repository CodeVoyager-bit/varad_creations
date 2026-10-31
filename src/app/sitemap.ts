import type { MetadataRoute } from "next";
import { POLICY_PAGES } from "@/lib/policy-drafts";
import { siteUrl } from "@/lib/site";
import { getCatalog } from "@/server/storefront";

/** Public, indexable pages only. Account, cart, checkout, admin, delivery and search are excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { categories, brands, products } = await getCatalog();
  const fixed = ["", "/products", "/categories", "/brands", ...POLICY_PAGES.map((p) => p.path)];
  return [
    ...fixed.map((p) => ({ url: `${siteUrl}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.5 })),
    ...categories.map((c) => ({ url: `${siteUrl}/c/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...brands.map((b) => ({ url: `${siteUrl}/b/${b.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products
      .filter((p) => p.status === "active")
      .map((p) => ({ url: `${siteUrl}/p/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.8, ...(p.images.length ? { images: p.images } : {}) })),
  ];
}
