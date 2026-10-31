import { saveBrandA, saveCategoryA } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin-ui";
import { ImagePicker } from "@/components/image-picker";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { C } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import type { BrandDoc, CategoryDoc } from "@/lib/types";

export const metadata = { title: "Brands & categories" };

function CategoryForm({ c }: { c?: CategoryDoc }) {
  return (
    <ActionForm action={saveCategoryA} resetOnSuccess={!c} className="grid gap-2 rounded-xl border border-cream-200 p-3 sm:grid-cols-6">
      {c && <input type="hidden" name="id" value={String(c._id)} />}
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" defaultValue={c?.name} required />
      </Field>
      <Field label="Slug">
        <Input name="slug" defaultValue={c?.slug} />
      </Field>
      <Field label="Type">
        <Select name="kind" defaultValue={c?.kind ?? "food"}>
          <option value="food">Food</option>
          <option value="nonfood">Non-food</option>
        </Select>
      </Field>
      <Field label="Order">
        <Input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input type="checkbox" name="visible" defaultChecked={c ? c.visible : true} className="accent-burgundy-600" /> Visible
      </label>
      <Field label="Description" className="sm:col-span-3">
        <Input name="description" defaultValue={c?.description} />
      </Field>
      <Field label="SEO title" className="sm:col-span-3">
        <Input name="seoTitle" defaultValue={c?.seo?.title} />
      </Field>
      <div className="sm:col-span-3">
        <span className="mb-1 block text-sm font-medium text-ink-700">Category image</span>
        <ImagePicker name="image" current={c?.image} label="Upload image" />
      </div>
      <div className="flex items-end sm:col-span-3">
        <Button size="sm" variant={c ? "secondary" : "primary"}>
          {c ? "Save" : "Add category"}
        </Button>
      </div>
    </ActionForm>
  );
}

function BrandForm({ b }: { b?: BrandDoc }) {
  return (
    <ActionForm action={saveBrandA} resetOnSuccess={!b} className="grid gap-2 rounded-xl border border-cream-200 p-3 sm:grid-cols-6">
      {b && <input type="hidden" name="id" value={String(b._id)} />}
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" defaultValue={b?.name} required />
      </Field>
      <Field label="Slug">
        <Input name="slug" defaultValue={b?.slug} />
      </Field>
      <Field label="Order">
        <Input name="sortOrder" type="number" defaultValue={b?.sortOrder ?? 0} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input type="checkbox" name="visible" defaultChecked={b ? b.visible : true} className="accent-burgundy-600" /> Visible
      </label>
      <div className="sm:col-span-3">
        <span className="mb-1 block text-sm font-medium text-ink-700">Brand logo</span>
        <ImagePicker name="logo" current={b?.logo} label="Upload logo" />
      </div>
      <Field label="SEO description" className="sm:col-span-3">
        <Input name="seoDescription" defaultValue={b?.seo?.description} />
      </Field>
      <div className="flex items-end sm:col-span-2">
        <Button size="sm" variant={b ? "secondary" : "primary"}>
          {b ? "Save" : "Add brand"}
        </Button>
      </div>
    </ActionForm>
  );
}

export default async function Catalog() {
  await requireAdmin();
  const [cats, brands] = await Promise.all([C.categories.find({}).sort({ sortOrder: 1 }).toArray(), C.brands.find({}).sort({ sortOrder: 1, name: 1 }).toArray()]);
  return (
    <div className="space-y-4">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900">Brands & categories</h1>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Categories</h2>
        <p className="text-xs text-ink-500">Hidden categories (e.g. Tupperware until launch) and all their products are invisible to customers and can’t be ordered.</p>
        {cats.map((c) => (
          <div key={String(c._id)}>
            {!c.visible && <Badge tone="neutral">hidden</Badge>}
            <CategoryForm c={c} />
          </div>
        ))}
        <CategoryForm />
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Brands</h2>
        {brands.map((b) => (
          <BrandForm key={String(b._id)} b={b} />
        ))}
        <BrandForm />
      </Card>
    </div>
  );
}
