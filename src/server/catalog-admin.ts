import { ObjectId } from "mongodb";
import { C } from "@/lib/db";
import type { BrandDoc, CategoryDoc, FoodInfo, NonFoodInfo, ProductDoc, VariantDoc } from "@/lib/types";
import { AppError, audit, slugify, type Actor } from "./core";

async function uniqueSlug(col: "products" | "brands" | "categories", wanted: string, selfId?: ObjectId) {
  const base = slugify(wanted) || "item";
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${base}-${i + 1}` : base;
    const clash = await (C[col] as unknown as import("mongodb").Collection<{ slug: string }>).findOne({ slug, ...(selfId ? { _id: { $ne: selfId } } : {}) });
    if (!clash) return slug;
  }
  throw new AppError("Could not create a unique URL slug.");
}

/** Old URLs keep working: a renamed slug leaves a permanent redirect behind. */
async function recordSlugChange(prefix: "p" | "b" | "c", from: string, to: string) {
  if (from === to) return;
  await C.redirects.updateMany({ to: `/${prefix}/${from}` }, { $set: { to: `/${prefix}/${to}` } });
  await C.redirects.deleteOne({ from: `/${prefix}/${to}` });
  await C.redirects.updateOne({ from: `/${prefix}/${from}` }, { $set: { to: `/${prefix}/${to}`, createdAt: new Date() } }, { upsert: true });
}

export async function saveCategory(actor: Actor, i: { id?: string; name: string; slug?: string; description?: string; kind: "food" | "nonfood"; visible: boolean; sortOrder: number; image?: string; seo?: { title?: string; description?: string } }) {
  if (!i.name.trim()) throw new AppError("Name is required.");
  const id = i.id ? new ObjectId(i.id) : new ObjectId();
  const before = i.id ? await C.categories.findOne({ _id: id }) : null;
  const slug = await uniqueSlug("categories", i.slug || i.name, id);
  const doc: Partial<CategoryDoc> = { name: i.name.trim(), slug, description: i.description, kind: i.kind, visible: i.visible, sortOrder: i.sortOrder, seo: i.seo, updatedAt: new Date(), ...(i.image ? { image: i.image } : {}) };
  await C.categories.updateOne({ _id: id }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  if (before) await recordSlugChange("c", before.slug, slug);
  await audit(actor, before ? "category.update" : "category.create", "category", id.toHexString(), i.name, before, doc);
}

export async function saveBrand(actor: Actor, i: { id?: string; name: string; slug?: string; description?: string; visible: boolean; sortOrder: number; logo?: string; seo?: { title?: string; description?: string } }) {
  if (!i.name.trim()) throw new AppError("Name is required.");
  const id = i.id ? new ObjectId(i.id) : new ObjectId();
  const before = i.id ? await C.brands.findOne({ _id: id }) : null;
  const slug = await uniqueSlug("brands", i.slug || i.name, id);
  const doc: Partial<BrandDoc> = { name: i.name.trim(), slug, description: i.description, visible: i.visible, sortOrder: i.sortOrder, seo: i.seo, updatedAt: new Date(), ...(i.logo ? { logo: i.logo } : {}) };
  await C.brands.updateOne({ _id: id }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  if (before) await recordSlugChange("b", before.slug, slug);
  await audit(actor, before ? "brand.update" : "brand.create", "brand", id.toHexString(), i.name, before, doc);
}

export interface ProductInput {
  id?: string;
  name: string;
  slug?: string;
  brandId: string;
  categoryId: string;
  kind: "food" | "nonfood";
  description: string;
  status: ProductDoc["status"];
  featured: boolean;
  bestseller: boolean;
  tags: string[];
  attributes: { label: string; value: string }[];
  food?: FoodInfo;
  nonFood?: NonFoodInfo;
  seo?: { title?: string; description?: string };
}

export async function saveProduct(actor: Actor, i: ProductInput) {
  if (!i.name.trim()) throw new AppError("Product name is required.");
  const [brand, cat] = await Promise.all([C.brands.findOne({ _id: new ObjectId(i.brandId) }), C.categories.findOne({ _id: new ObjectId(i.categoryId) })]);
  if (!brand || !cat) throw new AppError("Choose a brand and category.");
  const id = i.id ? new ObjectId(i.id) : new ObjectId();
  const before = i.id ? await C.products.findOne({ _id: id }) : null;
  const slug = await uniqueSlug("products", i.slug || `${brand.name} ${i.name}`, id);
  const doc: Partial<ProductDoc> = {
    name: i.name.trim(),
    slug,
    brandId: brand._id,
    categoryId: cat._id,
    kind: i.kind,
    description: i.description,
    status: i.status,
    featured: i.featured,
    bestseller: i.bestseller,
    tags: i.tags,
    attributes: i.attributes,
    food: i.kind === "food" ? i.food : undefined,
    nonFood: i.kind === "nonfood" ? i.nonFood : undefined,
    seo: i.seo,
    searchText: `${i.name} ${brand.name} ${cat.name} ${i.tags.join(" ")}`.toLowerCase(),
    updatedAt: new Date(),
  };
  await C.products.updateOne({ _id: id }, { $set: doc, $setOnInsert: { createdAt: new Date(), images: [], labelImages: [] } }, { upsert: true });
  if (before) await recordSlugChange("p", before.slug, slug);
  await audit(actor, before ? "product.update" : "product.create", "product", id.toHexString(), i.name, before && { ...before, searchText: undefined }, doc);
  return id.toHexString();
}

export async function setProductImages(actor: Actor, id: string, field: "images" | "labelImages", urls: string[]) {
  await C.products.updateOne({ _id: new ObjectId(id) }, { $set: { [field]: urls.slice(0, 12), updatedAt: new Date() } });
  await audit(actor, "product.images", "product", id, `${field}: ${urls.length}`);
}

export interface VariantInput {
  id?: string;
  productId: string;
  label: string;
  sku: string;
  netQty?: number;
  netUnit?: VariantDoc["netUnit"];
  mrpPaise: number;
  pricePaise: number;
  lowStockThreshold: number;
  active: boolean;
  sortOrder: number;
}

export async function saveVariant(actor: Actor, i: VariantInput) {
  if (!i.label.trim() || !i.sku.trim()) throw new AppError("Pack size label and SKU are required.");
  if (!Number.isInteger(i.mrpPaise) || !Number.isInteger(i.pricePaise) || i.pricePaise <= 0) throw new AppError("Enter valid prices.");
  // Legal Metrology: never sell a pre-packaged commodity above its MRP
  if (i.pricePaise > i.mrpPaise) throw new AppError("Selling price can't be higher than the MRP printed on the pack.");
  const id = i.id ? new ObjectId(i.id) : new ObjectId();
  const before = i.id ? await C.variants.findOne({ _id: id }) : null;
  if (await C.variants.findOne({ sku: i.sku.trim(), _id: { $ne: id } })) throw new AppError("Another pack size already uses this SKU.");
  const set = {
    productId: new ObjectId(i.productId),
    label: i.label.trim(),
    sku: i.sku.trim(),
    netQty: i.netQty,
    netUnit: i.netUnit,
    mrpPaise: i.mrpPaise,
    pricePaise: i.pricePaise,
    lowStockThreshold: i.lowStockThreshold,
    active: i.active,
    sortOrder: i.sortOrder,
    updatedAt: new Date(),
  };
  // stock counters are never set from a form; they only move through inventory operations
  await C.variants.updateOne({ _id: id }, { $set: set, $setOnInsert: { available: 0, reserved: 0, createdAt: new Date() } }, { upsert: true });
  if (!before || before.pricePaise !== i.pricePaise) await C.priceHistory.insertOne({ variantId: id, pricePaise: i.pricePaise, at: new Date() });
  if (before && (before.pricePaise !== i.pricePaise || before.mrpPaise !== i.mrpPaise))
    await audit(actor, "price.change", "variant", id.toHexString(), `${before.label}: ₹${before.pricePaise / 100} → ₹${i.pricePaise / 100} (MRP ₹${before.mrpPaise / 100} → ₹${i.mrpPaise / 100})`, { pricePaise: before.pricePaise, mrpPaise: before.mrpPaise }, { pricePaise: i.pricePaise, mrpPaise: i.mrpPaise });
  else await audit(actor, before ? "variant.update" : "variant.create", "variant", id.toHexString(), i.label);
}

export async function saveRedirect(actor: Actor, from: string, to: string) {
  const clean = (s: string) => "/" + s.trim().replace(/^https?:\/\/[^/]+/, "").replace(/^\/+/, "");
  const f = clean(from);
  const t = clean(to);
  if (f === t || f === "/") throw new AppError("Invalid redirect.");
  await C.redirects.updateOne({ from: f }, { $set: { to: t, createdAt: new Date() } }, { upsert: true });
  await audit(actor, "redirect.save", "redirect", f, `${f} → ${t}`);
}
