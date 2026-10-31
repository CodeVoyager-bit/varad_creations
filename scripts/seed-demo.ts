/**
 * DEMONSTRATION DATA — development only.
 * Every catalog record is flagged isDemo and shown with a "Sample" badge on the storefront.
 * Prices, stock and brand/product pairings are illustrative, not real selling prices.
 * Label fields (ingredients, nutrition, FSSAI...) are intentionally left blank: they must be
 * copied from real packs, never invented.
 *
 *   npm run seed:demo            (refuses to run when NODE_ENV=production)
 *   npm run seed:demo -- --reset (removes previous demo records first)
 */
import { ObjectId } from "mongodb";
import { C, client, ensureIndexes } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
import type { StorefrontContent } from "@/lib/types";
import { receiveStock } from "@/server/inventory";
import { slugify } from "@/server/core";
import { POLICY_DRAFTS } from "@/lib/policy-drafts";

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

const now = new Date();
const system = { id: "seed", role: "system" as const, name: "Demo seed" };

const categories = [
  { name: "Namkeen", kind: "food" as const, visible: true },
  { name: "Bakery", kind: "food" as const, visible: true },
  { name: "Pickles", kind: "food" as const, visible: true },
  { name: "Fasting", kind: "food" as const, visible: true, description: "Snacks commonly chosen for upvas. Check each pack's ingredient list for your fasting rules." },
  { name: "Sweets", kind: "food" as const, visible: true },
  { name: "Tupperware", kind: "nonfood" as const, visible: false, description: "Hidden until the admin enables it." },
];
const brands = ["Agrawal 420", "Mahendra", "Pushp", "Chheda's", "Aathavlez", "Gangwal", "Jai Jalaram"];

// [name, brand, category, variants [label, mrp, price, stock], flags]
const products: [string, string, string, [string, number, number, number][], { bestseller?: boolean; featured?: boolean; tags?: string[] }?][] = [
  ["Ratlami Sev", "Agrawal 420", "Namkeen", [["250 g", 90, 85, 40], ["500 g", 175, 165, 20]], { bestseller: true, tags: ["indori-classics"] }],
  ["Khatta Meetha", "Agrawal 420", "Namkeen", [["250 g", 80, 75, 35], ["1 kg", 300, 285, 8]], { bestseller: true, tags: ["indori-classics"] }],
  ["Indori Mixture", "Mahendra", "Namkeen", [["400 g", 140, 130, 25]], { featured: true, tags: ["indori-classics"] }],
  ["Laung Sev", "Mahendra", "Namkeen", [["250 g", 95, 90, 6]], { tags: ["indori-classics"] }],
  ["Garlic Sev", "Pushp", "Namkeen", [["200 g", 70, 65, 30]], { bestseller: true }],
  ["Navratan Mixture", "Chheda's", "Namkeen", [["170 g", 60, 60, 50], ["400 g", 130, 125, 18]], { featured: true }],
  ["Banana Chips", "Chheda's", "Fasting", [["170 g", 65, 62, 22]], { tags: ["upvas"] }],
  ["Farali Chivda", "Gangwal", "Fasting", [["200 g", 80, 75, 15]], { bestseller: true, tags: ["upvas"] }],
  ["Sabudana Chivda", "Jai Jalaram", "Fasting", [["250 g", 85, 80, 0]], { tags: ["upvas"] }],
  ["Khari Biscuit", "Aathavlez", "Bakery", [["200 g", 60, 55, 30]], { featured: true }],
  ["Butter Nankhatai", "Aathavlez", "Bakery", [["250 g", 120, 110, 12]]],
  ["Rusk Toast", "Gangwal", "Bakery", [["300 g", 70, 68, 40]]],
  ["Mango Pickle", "Jai Jalaram", "Pickles", [["400 g", 150, 140, 14], ["1 kg", 330, 310, 4]], { featured: true }],
  ["Lemon Pickle", "Jai Jalaram", "Pickles", [["400 g", 140, 130, 10]]],
  ["Soan Papdi", "Gangwal", "Sweets", [["250 g", 95, 90, 20]]],
  ["Lunch Box Set (demo)", "Pushp", "Tupperware", [["Set of 3", 650, 599, 5]]],
];

async function main() {
  await ensureIndexes();
  if (process.argv.includes("--reset")) {
    const demoProducts = await C.products.find({ isDemo: true }).project({ _id: 1 }).toArray();
    const variantIds = (await C.variants.find({ productId: { $in: demoProducts.map((p) => p._id) } }).project({ _id: 1 }).toArray()).map((v) => v._id);
    await C.batches.deleteMany({ variantId: { $in: variantIds } });
    await C.movements.deleteMany({ variantId: { $in: variantIds } });
    await C.variants.deleteMany({ _id: { $in: variantIds } });
    await C.products.deleteMany({ isDemo: true });
    await C.brands.deleteMany({ isDemo: true });
    await C.categories.deleteMany({ isDemo: true });
    await C.coupons.deleteMany({ code: { $in: ["DEMO50", "DEMOFIRST"] } });
  }
  if (await C.products.countDocuments({ isDemo: true })) {
    console.log("Demo data already present. Use --reset to recreate.");
    return;
  }

  // dev only: an unroutable UPI handle so the payment screen can be exercised without real money
  await C.settings.updateOne(
    { _id: "business" },
    { $setOnInsert: { ...DEFAULT_SETTINGS, upi: { vpa: "demo-do-not-pay@invalid", payeeName: "DEMO - do not pay" }, updatedAt: now } },
    { upsert: true },
  );

  const catIds = new Map<string, ObjectId>();
  for (const [i, c] of categories.entries()) {
    const _id = new ObjectId();
    catIds.set(c.name, _id);
    await C.categories.insertOne({ _id, slug: slugify(c.name), name: c.name, description: c.description, kind: c.kind, visible: c.visible, sortOrder: i, isDemo: true, createdAt: now, updatedAt: now });
  }
  const brandIds = new Map<string, ObjectId>();
  for (const [i, b] of brands.entries()) {
    const _id = new ObjectId();
    brandIds.set(b, _id);
    await C.brands.insertOne({ _id, slug: slugify(b), name: b, visible: true, sortOrder: i, isDemo: true, createdAt: now, updatedAt: now });
  }

  let sku = 100;
  for (const [name, brand, cat, variants, flags = {}] of products) {
    const _id = new ObjectId();
    const kind = cat === "Tupperware" ? "nonfood" : "food";
    await C.products.insertOne({
      _id,
      slug: slugify(`${brand} ${name}`),
      name,
      brandId: brandIds.get(brand)!,
      categoryId: catIds.get(cat)!,
      kind,
      description: "",
      images: [],
      labelImages: [],
      status: "active",
      featured: !!flags.featured,
      bestseller: !!flags.bestseller,
      tags: flags.tags ?? [],
      attributes: [],
      ...(kind === "food" ? { food: {} } : { nonFood: {} }),
      searchText: `${name} ${brand} ${cat} ${(flags.tags ?? []).join(" ")}`.toLowerCase(),
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    });
    for (const [k, [label, mrp, price, stock]] of variants.entries()) {
      const vid = new ObjectId();
      const m = label.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l)$/i) ?? label.match(/^Set of (\d+)$/);
      await C.priceHistory.insertOne({ variantId: vid, pricePaise: price * 100, at: now });
      await C.variants.insertOne({
        _id: vid,
        productId: _id,
        sku: `DEMO-${sku++}`,
        label,
        ...(m ? { netQty: Number(m[1]), netUnit: (m[2]?.toLowerCase() ?? "pc") as "g" | "kg" | "ml" | "l" | "pc" } : {}),
        mrpPaise: mrp * 100,
        pricePaise: price * 100,
        available: 0,
        reserved: 0,
        lowStockThreshold: 5,
        active: true,
        sortOrder: k,
        createdAt: now,
        updatedAt: now,
      });
      if (stock > 0)
        await receiveStock(system, {
          variantId: vid.toHexString(),
          qty: stock,
          batchNo: `DEMO-B${sku}`,
          expiryDate: kind === "food" ? new Date(now.getTime() + (20 + (sku % 5) * 30) * 86400_000) : undefined,
          note: "Demo opening stock",
        });
    }
  }

  await C.coupons.insertMany([
    {
      _id: new ObjectId(), code: "DEMO50", description: "Demo: ₹50 off on orders of ₹499 or more", type: "fixed", value: 5000, minSubtotalPaise: 49900,
      maxDiscountPaise: null, startsAt: null, endsAt: null, usageLimit: 100, usedCount: 0, perCustomerLimit: 1, eligibleProductIds: [], eligibleCategoryIds: [], eligibleBrandIds: [],
      firstOrderOnly: false, showOnStorefront: true, active: true, createdAt: now, updatedAt: now,
    },
    {
      _id: new ObjectId(), code: "DEMOFIRST", description: "Demo: 10% off your first order (up to ₹100)", type: "percent", value: 10, minSubtotalPaise: 0,
      maxDiscountPaise: 10000, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0, perCustomerLimit: 1, eligibleProductIds: [], eligibleCategoryIds: [], eligibleBrandIds: [],
      firstOrderOnly: true, showOnStorefront: true, active: true, createdAt: now, updatedAt: now,
    },
  ]);

  const storefront: StorefrontContent = {
    banners: [{ id: "b1", title: "Indori favourites. Delivered home.", subtitle: "Branded namkeen, bakery and pickles — delivered across Pune and PCMC.", href: "/c/namkeen", active: true }],
    collections: [
      { id: "c1", title: "Indori classics", subtitle: "Sev, mixture and khatta meetha", tag: "indori-classics", active: true },
      { id: "c2", title: "For upvas", subtitle: "Check each pack's ingredients for your fasting rules", tag: "upvas", active: true },
    ],
  };
  await C.content.updateOne({ _id: "storefront" }, { $setOnInsert: { draft: storefront, published: storefront, publishedAt: now, publishedBy: "seed", updatedAt: now } }, { upsert: true });
  for (const [slug, p] of Object.entries(POLICY_DRAFTS)) {
    await C.content.updateOne({ _id: `policy:${slug}` }, { $setOnInsert: { draft: p, published: p, publishedAt: now, publishedBy: "seed", updatedAt: now } }, { upsert: true });
  }
  console.log(`Seeded ${products.length} demo products, ${brands.length} brands, ${categories.length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.close());
