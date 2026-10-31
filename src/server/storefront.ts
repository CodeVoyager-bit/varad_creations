import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { C } from "@/lib/db";
import type { ShopBrand, ShopCategory, ShopProduct, ShopProductDetail } from "@/lib/shop-types";
import type { PolicyContent, StorefrontContent, VariantDoc } from "@/lib/types";
import { rupees } from "@/lib/money";
import { loadSettings } from "./settings";

/**
 * Public catalog reads. Cached and tagged; admin mutations and stock changes call
 * revalidateTag(...) so pages refresh without a deploy. Never put per-user data here.
 */

export const TAGS = { catalog: "catalog", settings: "settings", storefront: "storefront", redirects: "redirects", policy: (s: string) => `policy:${s}` };

export async function getSettings() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.settings);
  const s = await loadSettings();
  // only public fields leave the server
  const { upi: _upi, updatedAt: _u, ...pub } = s;
  return pub;
}
export type PublicSettings = Awaited<ReturnType<typeof getSettings>>;

export async function getCatalog() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  const [cats, brands] = await Promise.all([
    C.categories.find({ visible: true }).sort({ sortOrder: 1, name: 1 }).toArray(),
    C.brands.find({ visible: true }).sort({ sortOrder: 1, name: 1 }).toArray(),
  ]);
  const products = await C.products
    .find({ status: { $in: ["active", "discontinued"] }, categoryId: { $in: cats.map((c) => c._id) }, brandId: { $in: brands.map((b) => b._id) } })
    .sort({ name: 1 })
    .toArray();
  const variants = await C.variants.find({ productId: { $in: products.map((p) => p._id) }, active: true }).sort({ sortOrder: 1, pricePaise: 1 }).toArray();
  const lows = await C.priceHistory
    .aggregate<{ _id: import("mongodb").ObjectId; min: number }>([
      { $match: { variantId: { $in: variants.map((v) => v._id) }, at: { $gte: new Date(Date.now() - 30 * 86400_000) } } },
      { $group: { _id: "$variantId", min: { $min: "$pricePaise" } } },
    ])
    .toArray();

  const categories: ShopCategory[] = cats.map((c) => ({ id: c._id.toHexString(), slug: c.slug, name: c.name, description: c.description, image: c.image, seo: c.seo }));
  const shopBrands: ShopBrand[] = brands.map((b) => ({ id: b._id.toHexString(), slug: b.slug, name: b.name, description: b.description, logo: b.logo, seo: b.seo }));
  const details: ShopProductDetail[] = [];
  for (const p of products) {
    const cat = cats.find((c) => c._id.equals(p.categoryId))!;
    const brand = brands.find((b) => b._id.equals(p.brandId))!;
    const vs = variants.filter((v) => v.productId.equals(p._id));
    if (!vs.length) continue;
    details.push({
      id: p._id.toHexString(),
      slug: p.slug,
      name: p.name,
      brand: { name: brand.name, slug: brand.slug },
      category: { name: cat.name, slug: cat.slug },
      image: p.images[0],
      images: p.images,
      labelImages: p.labelImages,
      isDemo: !!p.isDemo,
      bestseller: p.bestseller,
      featured: p.featured,
      tags: p.tags,
      kind: p.kind,
      description: p.description,
      status: p.status === "discontinued" ? "discontinued" : "active",
      food: p.food,
      nonFood: p.nonFood,
      attributes: p.attributes,
      seo: p.seo,
      updatedAt: p.updatedAt.toISOString(),
      variants: vs.map((v) => ({
        id: v._id.toHexString(),
        label: v.label,
        mrpPaise: v.mrpPaise,
        pricePaise: v.pricePaise,
        inStock: p.status === "active" && v.available > 0,
        fewLeft: p.status === "active" && v.available > 0 && v.available <= v.lowStockThreshold ? v.available : undefined,
        unitPrice: unitPrice(v),
        lowest30Paise: Math.min(v.pricePaise, lows.find((l) => l._id.equals(v._id))?.min ?? v.pricePaise),
      })),
    });
  }
  // give tiles a real pack shot (bestsellers first) until dedicated images are uploaded
  const ranked = [...details].filter((p) => p.status === "active").sort((a, b) => Number(b.bestseller) - Number(a.bestseller) || Number(b.featured) - Number(a.featured));
  for (const c of categories) {
    const mine = ranked.filter((p) => p.category.slug === c.slug);
    c.productCount = mine.length;
    c.packImage = mine.find((p) => p.image)?.image;
  }
  for (const b of shopBrands) {
    const mine = ranked.filter((p) => p.brand.slug === b.slug);
    b.productCount = mine.length;
    b.packImage = mine.find((p) => p.image)?.image;
  }
  return { categories, brands: shopBrands, products: details };
}

export function unitPrice(v: Pick<VariantDoc, "pricePaise" | "netQty" | "netUnit">) {
  if (!v.netQty || !v.netUnit) return undefined;
  if (v.netUnit === "pc") return v.netQty > 1 ? `${rupees(Math.round(v.pricePaise / v.netQty), { decimals: true })} / piece` : undefined;
  const liquid = v.netUnit === "ml" || v.netUnit === "l";
  const base = v.netUnit === "kg" || v.netUnit === "l" ? v.netQty * 1000 : v.netQty;
  return base >= 1000
    ? `${rupees(Math.round((v.pricePaise * 1000) / base), { decimals: true })} / ${liquid ? "L" : "kg"}`
    : `${rupees(Math.round((v.pricePaise * 100) / base), { decimals: true })} / 100 ${liquid ? "ml" : "g"}`;
}

/** Slim card data for client components. */
export const toCard = (p: ShopProductDetail): ShopProduct => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  brand: p.brand,
  category: p.category,
  image: p.image,
  isDemo: p.isDemo,
  bestseller: p.bestseller,
  featured: p.featured,
  tags: p.tags,
  variants: p.variants,
});

export async function getStorefront(): Promise<StorefrontContent> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.storefront);
  const doc = await C.content.findOne({ _id: "storefront" });
  return (doc?.published as StorefrontContent) ?? { banners: [], collections: [] };
}

export async function getOffers() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  const now = new Date();
  const list = await C.coupons
    .find({ active: true, showOnStorefront: true, $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }] })
    .limit(6)
    .toArray();
  return list
    .filter((c) => c.usageLimit == null || c.usedCount < c.usageLimit)
    .map((c) => ({ code: c.code, description: c.description ?? "", endsAt: c.endsAt?.toISOString() }));
}

export async function getPolicy(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.policy(slug));
  const doc = await C.content.findOne({ _id: `policy:${slug}` });
  return (doc?.published as PolicyContent | null) ?? null;
}

export async function getRedirect(from: string) {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.redirects);
  const r = await C.redirects.findOne({ from });
  return r?.to ?? null;
}
