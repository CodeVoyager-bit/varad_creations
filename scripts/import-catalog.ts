/**
 * Replaces the sample catalogue with researched real products — names, pack sizes and MRPs
 * as listed by the brand or a major retailer, plus each product's pack-shot photo, re-hosted
 * on Cloudinary (or public/uploads without Cloudinary in development).
 *
 * Development data only: everything stays flagged isDemo (stock is illustrative, and the shop
 * must confirm every price and label before launch). Products without a listed MRP are
 * imported as drafts, hidden from customers, so no price is ever invented.
 *
 *   npm run import:catalog -- data/catalog/*.json
 */
import { readFileSync } from "node:fs";
import { ObjectId } from "mongodb";
import { C, client, ensureIndexes } from "@/lib/db";
import { slugify } from "@/server/core";
import { receiveStock } from "@/server/inventory";
import { savePublicImage } from "@/server/storage";

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("Refusing to import sample catalogue data in production.");
  process.exit(1);
}

interface Pack {
  label: string;
  netQty?: number | null;
  netUnit?: "g" | "kg" | "ml" | "l" | "pc" | null;
  mrp?: number | null;
}
interface Item {
  name: string;
  notes?: string;
  category: string | null;
  veg?: boolean | null;
  packs: Pack[];
  imageUrl?: string | null;
  imageSourcePage?: string | null;
}
interface BrandEntry {
  brand: string;
  company?: string;
  logoUrl?: string | null;
  notes?: string;
  products: Item[];
}

const system = { id: "catalog-import", role: "system" as const, name: "Catalogue import" };
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

/** Downloads, then lets the app's own upload path validate the bytes and store it. */
async function rehost(url: string, referer?: string | null) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/webp,image/jpeg,image/png,*/*", ...(referer ? { Referer: referer } : {}) }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return savePublicImage(new File([buf], "pack.jpg"), "products");
}

async function main() {
  const files = process.argv.slice(2).filter((f) => f.endsWith(".json"));
  if (!files.length) throw new Error("Usage: npm run import:catalog -- data/catalog/*.json");
  const entries: BrandEntry[] = files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
  // items the research couldn't place (flours, instant mixes, papad) get a staples shelf
  for (const e of entries) for (const p of e.products) p.category ??= /masala/i.test(p.name) ? "Masala" : "Mixes & staples";
  await ensureIndexes();

  // clear previous sample products (brands and categories are kept and reused)
  const old = await C.products.find({ isDemo: true }).project({ _id: 1 }).toArray();
  const oldVariants = (await C.variants.find({ productId: { $in: old.map((p) => p._id) } }).project({ _id: 1 }).toArray()).map((v) => v._id);
  await Promise.all([
    C.batches.deleteMany({ variantId: { $in: oldVariants } }),
    C.movements.deleteMany({ variantId: { $in: oldVariants } }),
    C.priceHistory.deleteMany({ variantId: { $in: oldVariants } }),
  ]);
  await C.variants.deleteMany({ _id: { $in: oldVariants } });
  await C.products.deleteMany({ isDemo: true });

  const now = new Date();
  // categories the research found that the store doesn't have yet (e.g. Masala) are created
  const cats = await C.categories.find({}).toArray();
  for (const name of new Set(entries.flatMap((e) => e.products.map((p) => p.category!)))) {
    if (!cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      const doc = { _id: new ObjectId(), slug: slugify(name), name, kind: "food" as const, visible: true, sortOrder: cats.length, isDemo: true, createdAt: now, updatedAt: now };
      await C.categories.insertOne(doc);
      cats.push(doc);
      console.log(`+ category ${name}`);
    }
  }
  const catId = (name: string) => cats.find((c) => c.name.toLowerCase() === name.toLowerCase())!._id;
  const report = { products: 0, drafts: 0, images: 0, imageFailures: [] as string[] };
  let sku = 1000;

  for (const [bi, e] of entries.entries()) {
    if (!e.products?.length) continue;
    let brand = await C.brands.findOne({ name: new RegExp(`^${e.brand.replace(/[^\w\s']/g, ".")}$`, "i") });
    if (!brand) {
      const _id = new ObjectId();
      await C.brands.insertOne({ _id, slug: slugify(e.brand), name: e.brand, visible: true, sortOrder: 10 + bi, isDemo: true, createdAt: now, updatedAt: now });
      brand = (await C.brands.findOne({ _id }))!;
    }
    if (e.logoUrl && !brand.logo) {
      try {
        await C.brands.updateOne({ _id: brand._id }, { $set: { logo: await rehost(e.logoUrl), updatedAt: now } });
      } catch (err) {
        report.imageFailures.push(`${e.brand} logo: ${(err as Error).message}`);
      }
    }
    const indori = /indore/i.test(`${e.company ?? ""} ${e.notes ?? ""}`);

    for (const [pi, item] of e.products.entries()) {
      // a single unpriced pack may use the brand's own stated selling price ("… price ₹125") as its sample price
      const unpriced = item.packs.filter((p) => !p.mrp);
      const sitePrice = Number(item.notes?.match(/price\s*₹\s?(\d+)/i)?.[1]);
      if (unpriced.length === 1 && sitePrice > 0) unpriced[0].mrp = sitePrice;
      const priced = item.packs.filter((p) => p.mrp && p.mrp > 0);
      let image: string | undefined;
      if (item.imageUrl) {
        try {
          image = await rehost(item.imageUrl, item.imageSourcePage);
          report.images++;
        } catch (err) {
          report.imageFailures.push(`${e.brand} ${item.name}: ${(err as Error).message}`);
        }
      }
      const category = catId(item.category!);
      const catName = cats.find((c) => c._id.equals(category))?.name ?? item.category;
      const tags = [item.category!.toLowerCase() === "fasting" ? "upvas" : "", indori && item.category!.toLowerCase() === "namkeen" ? "indori-classics" : ""].filter(Boolean);
      const productId = new ObjectId();
      await C.products.insertOne({
        _id: productId,
        slug: await uniqueSlug(slugify(`${e.brand} ${item.name}`)),
        name: item.name,
        brandId: brand._id,
        categoryId: category,
        kind: "food",
        description: "",
        images: image ? [image] : [],
        labelImages: [],
        status: priced.length ? "active" : "draft",
        featured: pi === 1,
        bestseller: pi === 0,
        tags,
        attributes: [],
        food: item.veg === true ? { dietary: "veg" } : item.veg === false ? { dietary: "nonveg" } : {},
        searchText: `${item.name} ${e.brand} ${catName} ${tags.join(" ")}`.toLowerCase(),
        isDemo: true,
        createdAt: now,
        updatedAt: now,
      });
      if (priced.length) report.products++;
      else report.drafts++;
      for (const [k, p] of priced.entries()) {
        const vid = new ObjectId();
        const paise = Math.round(p.mrp! * 100);
        await C.variants.insertOne({
          _id: vid,
          productId,
          sku: `SAMPLE-${sku++}`,
          label: p.label || "1 pack",
          ...(p.netQty && p.netUnit ? { netQty: p.netQty, netUnit: p.netUnit } : {}),
          mrpPaise: paise,
          pricePaise: paise, // sold at MRP: no discount is invented
          available: 0,
          reserved: 0,
          lowStockThreshold: 5,
          active: true,
          sortOrder: k,
          createdAt: now,
          updatedAt: now,
        });
        await C.priceHistory.insertOne({ variantId: vid, pricePaise: paise, at: now });
        await receiveStock(system, {
          variantId: vid.toHexString(),
          qty: 12 + ((sku * 7) % 30),
          batchNo: `SAMPLE-B${sku}`,
          expiryDate: new Date(now.getTime() + (60 + (sku % 4) * 30) * 86400_000),
          note: "Sample opening stock (development)",
        });
      }
      console.log(`${priced.length ? "✓" : "· draft"} ${e.brand} — ${item.name}${image ? "" : "  (no photo)"}`);
    }
  }
  // sample brands left without products (e.g. a misspelt placeholder) are removed
  for (const b of await C.brands.find({ isDemo: true }).toArray()) {
    if (!(await C.products.countDocuments({ brandId: b._id }))) {
      await C.brands.deleteOne({ _id: b._id });
      console.log(`- removed empty sample brand ${b.name}`);
    }
  }
  console.log(`\nImported ${report.products} products (${report.drafts} drafts without a listed MRP), ${report.images} photos.`);
  if (report.imageFailures.length) console.log("Photos that could not be fetched:\n  " + report.imageFailures.join("\n  "));
}

async function uniqueSlug(base: string) {
  for (let i = 0; ; i++) {
    const slug = i ? `${base}-${i + 1}` : base;
    if (!(await C.products.findOne({ slug }))) return slug;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.close());
