import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { editProductImages, saveProductA, saveVariantA, uploadProductImage } from "@/app/actions/admin";
import { ActionButton, ActionForm } from "@/components/admin-ui";
import { ImagePicker } from "@/components/image-picker";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { C } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import type { ProductDoc, VariantDoc } from "@/lib/types";

export const metadata = { title: "Edit product" };

const rs = (p?: number) => (p != null ? (p / 100).toFixed(2) : "");

export default async function EditProduct({ params }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const isNew = id === "new";
  const p: Partial<ProductDoc> | null = isNew ? { status: "draft", kind: "food", tags: [], attributes: [], images: [], labelImages: [] } : ObjectId.isValid(id) ? await C.products.findOne({ _id: new ObjectId(id) }) : null;
  if (!p) notFound();
  const [brands, cats, variants] = await Promise.all([
    C.brands.find({}).sort({ name: 1 }).toArray(),
    C.categories.find({}).sort({ sortOrder: 1 }).toArray(),
    isNew ? [] : C.variants.find({ productId: new ObjectId(id) }).sort({ sortOrder: 1 }).toArray(),
  ]);
  const f = p.food ?? {};
  const n = p.nonFood ?? {};
  const food: [keyof typeof f, string, boolean][] = [
    ["ingredients", "Ingredients (as on pack)", true],
    ["allergens", "Allergen declaration (“Contains: …”)", true],
    ["additives", "Additives", false],
    ["nutrition", "Nutrition information (per 100 g, as on pack)", true],
    ["storage", "Storage instructions", false],
    ["shelfLife", "Shelf life / best before (as on pack)", false],
    ["instructions", "Instructions for use", false],
    ["manufacturer", "Manufacturer / packer name & address", true],
    ["marketer", "Marketed by (brand owner) name & address", false],
    ["fssaiLicence", "Brand owner’s FSSAI licence no.", false],
    ["consumerCare", "Consumer care details", false],
    ["importer", "Importer (imported goods only)", false],
    ["countryOfOrigin", "Country of origin", false],
  ];
  const nonFood: [keyof typeof n, string][] = [
    ["material", "Material"],
    ["capacity", "Capacity"],
    ["dimensions", "Dimensions"],
    ["care", "Care instructions"],
    ["warranty", "Warranty"],
    ["manufacturer", "Manufacturer / packer"],
    ["consumerCare", "Consumer care"],
    ["importer", "Importer"],
    ["countryOfOrigin", "Country of origin"],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/admin/products" className="text-sm font-semibold text-burgundy-700">
        ← Products
      </Link>
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900">{isNew ? "New product" : p.name}</h1>
      {!isNew && p.slug && (
        <a href={`/p/${p.slug}`} target="_blank" className="text-sm text-burgundy-700 underline">
          View on store
        </a>
      )}
      <Notice tone="info">Copy label information exactly from the pack. Never add health claims or dietary labels that aren’t printed on the pack.</Notice>

      <ActionForm action={saveProductA} className="space-y-4">
        {!isNew && <input type="hidden" name="id" value={id} />}
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Product name" className="sm:col-span-2">
            <Input name="name" defaultValue={p.name} required />
          </Field>
          <Field label="Brand">
            <Select name="brandId" defaultValue={p.brandId ? String(p.brandId) : ""} required>
              <option value="" disabled>
                Choose…
              </option>
              {brands.map((b) => (
                <option key={String(b._id)} value={String(b._id)}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select name="categoryId" defaultValue={p.categoryId ? String(p.categoryId) : ""} required>
              <option value="" disabled>
                Choose…
              </option>
              {cats.map((c) => (
                <option key={String(c._id)} value={String(c._id)}>
                  {c.name}
                  {c.visible ? "" : " (hidden)"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select name="kind" defaultValue={p.kind}>
              <option value="food">Food</option>
              <option value="nonfood">Non-food (e.g. Tupperware)</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={p.status}>
              <option value="draft">Draft (hidden)</option>
              <option value="active">Active (on sale)</option>
              <option value="discontinued">Discontinued (page stays, not sold, not indexed)</option>
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea name="description" defaultValue={p.description} rows={3} />
          </Field>
          <Field label="Tags (comma separated)" hint="Used by homepage collections, e.g. indori-classics, upvas">
            <Input name="tags" defaultValue={p.tags?.join(", ")} />
          </Field>
          <Field label="URL slug" hint="Leave blank to generate. Changing it redirects the old URL.">
            <Input name="slug" defaultValue={p.slug} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="bestseller" defaultChecked={p.bestseller} className="accent-burgundy-600" /> Show in Bestsellers
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="featured" defaultChecked={p.featured} className="accent-burgundy-600" /> Show in Featured
          </label>
        </Card>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Food label information</h2>
          <Field label="Veg / non-veg (as declared on pack)">
            <Select name="food.dietary" defaultValue={f.dietary ?? ""}>
              <option value="">Not entered</option>
              <option value="veg">Vegetarian (green mark on pack)</option>
              <option value="nonveg">Non-vegetarian (brown mark on pack)</option>
            </Select>
          </Field>
          {food.map(([k, label, long]) => (
            <Field key={k} label={label} className={long ? "sm:col-span-2" : ""}>
              {long ? <Textarea name={`food.${k}`} defaultValue={f[k]} rows={2} /> : <Input name={`food.${k}`} defaultValue={f[k]} />}
            </Field>
          ))}
        </Card>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Non-food details</h2>
          {nonFood.map(([k, label]) => (
            <Field key={k} label={label}>
              <Input name={`nonFood.${k}`} defaultValue={n[k]} />
            </Field>
          ))}
          <Field label="Other attributes (one per line, “Label: value”)" className="sm:col-span-2">
            <Textarea name="attributes" defaultValue={p.attributes?.map((a) => `${a.label}: ${a.value}`).join("\n")} rows={3} />
          </Field>
        </Card>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Search engines</h2>
          <Field label="SEO title" hint="Default: brand + name + pack size">
            <Input name="seoTitle" defaultValue={p.seo?.title} maxLength={70} />
          </Field>
          <Field label="SEO description">
            <Input name="seoDescription" defaultValue={p.seo?.description} maxLength={160} />
          </Field>
        </Card>
        <Button size="lg">{isNew ? "Create product" : "Save product"}</Button>
      </ActionForm>

      {!isNew && (
        <>
          {(["images", "labelImages"] as const).map((field) => (
            <Card key={field} className="space-y-3 p-4">
              <h2 className="font-semibold">{field === "images" ? "Product photos (first one is the main image)" : "Label / back-of-pack photos"}</h2>
              <ul className="flex flex-wrap gap-3">
                {(p[field] ?? []).map((url, i) => (
                  <li key={url} className="w-28 space-y-1 text-center">
                    <span className="relative block size-28 overflow-hidden rounded-xl border border-cream-300 bg-white">
                      <Image src={url} alt="" fill sizes="112px" className="object-contain" />
                    </span>
                    {i > 0 && (
                      <ActionButton size="sm" variant="ghost" action={editProductImages.bind(null, id, field, url, "first")}>
                        Make first
                      </ActionButton>
                    )}
                    <ActionButton size="sm" variant="ghost" action={editProductImages.bind(null, id, field, url, "remove")} confirm="Remove this image?">
                      Remove
                    </ActionButton>
                  </li>
                ))}
              </ul>
              <ActionForm action={uploadProductImage.bind(null, id, field)} resetOnSuccess className="space-y-2">
                <ImagePicker name="files" multiple required label={field === "images" ? "Add product photos" : "Add label photos"} hint="Select several at once · JPEG, PNG or WebP · up to 5 MB each" />
                <Button size="sm">Upload</Button>
              </ActionForm>
            </Card>
          ))}
          <Card className="space-y-3 p-4">
            <h2 className="font-semibold">Pack sizes & prices</h2>
            <p className="text-xs text-ink-500">Selling price can never exceed the MRP on the pack. Stock is changed only from Inventory.</p>
            {[...variants, null].map((v: VariantDoc | null) => (
              <ActionForm key={v ? String(v._id) : "new"} action={saveVariantA} resetOnSuccess={!v} className="grid gap-2 rounded-xl border border-cream-200 p-3 sm:grid-cols-6">
                <input type="hidden" name="productId" value={id} />
                {v && <input type="hidden" name="id" value={String(v._id)} />}
                <Field label="Pack size label">
                  <Input name="label" defaultValue={v?.label} placeholder="250 g" required />
                </Field>
                <Field label="Net qty">
                  <Input name="netQty" defaultValue={v?.netQty} inputMode="decimal" placeholder="250" />
                </Field>
                <Field label="Unit">
                  <Select name="netUnit" defaultValue={v?.netUnit ?? "g"}>
                    {["g", "kg", "ml", "l", "pc"].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="MRP ₹">
                  <Input name="mrp" defaultValue={rs(v?.mrpPaise)} inputMode="decimal" required />
                </Field>
                <Field label="Price ₹">
                  <Input name="price" defaultValue={rs(v?.pricePaise)} inputMode="decimal" required />
                </Field>
                <Field label="SKU">
                  <Input name="sku" defaultValue={v?.sku} required />
                </Field>
                <Field label="Low-stock alert at">
                  <Input name="lowStockThreshold" type="number" min={0} defaultValue={v?.lowStockThreshold ?? 5} />
                </Field>
                <Field label="Sort">
                  <Input name="sortOrder" type="number" defaultValue={v?.sortOrder ?? variants.length} />
                </Field>
                <label className="flex items-center gap-2 self-end pb-3 text-sm">
                  <input type="checkbox" name="active" defaultChecked={v ? v.active : true} className="accent-burgundy-600" /> On sale
                </label>
                <div className="flex items-end gap-2 sm:col-span-3">
                  <Button size="sm" variant={v ? "secondary" : "primary"}>
                    {v ? "Save" : "Add pack size"}
                  </Button>
                  {v && (
                    <span className="pb-2 text-xs text-ink-500">
                      Stock: {v.available} free · {v.reserved} held ·{" "}
                      <Link href={`/admin/inventory/${v._id}`} className="underline">
                        manage
                      </Link>
                    </span>
                  )}
                </div>
              </ActionForm>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
