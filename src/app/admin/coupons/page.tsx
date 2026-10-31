import { saveCouponA } from "@/app/actions/admin";
import { ActionForm, Disclosure } from "@/components/admin-ui";
import { ChipSelect } from "@/components/chip-select";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { C } from "@/lib/db";
import { rupees } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import type { CouponDoc } from "@/lib/types";

export const metadata = { title: "Coupons" };

const d = (x?: Date | null) => (x ? x.toISOString().slice(0, 16) : "");

type Named = { _id: import("mongodb").ObjectId; name: string };

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-2xl bg-cream-50 px-4 py-3 ring-1 ring-cream-300/70">
      <span>
        <span className="block text-sm font-semibold text-ink-900">{label}</span>
        <span className="block text-xs text-ink-500">{hint}</span>
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-cream-300 transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-leaf-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-saffron-500" />
    </label>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="space-y-3">
    <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">{title}</legend>
    {children}
  </fieldset>
);

function CouponForm({ c, cats, brands, products }: { c?: CouponDoc; cats: Named[]; brands: Named[]; products: { value: string; label: string }[] }) {
  const opts = (xs: Named[]) => xs.map((x) => ({ value: String(x._id), label: x.name }));
  return (
    <ActionForm action={saveCouponA} resetOnSuccess={!c} className="space-y-6">
      {c && <input type="hidden" name="id" value={String(c._id)} />}
      <Section title="Discount">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Code">
            <Input name="code" defaultValue={c?.code} required autoComplete="off" spellCheck={false} placeholder="e.g. DIWALI50…" className="font-mono uppercase" />
          </Field>
          <Field label="Type">
            <Select name="type" defaultValue={c?.type ?? "fixed"}>
              <option value="fixed">Fixed ₹ off</option>
              <option value="percent">Percent off</option>
            </Select>
          </Field>
          <Field label="Value" hint="₹ for fixed, % for percent">
            <Input name="value" inputMode="decimal" defaultValue={c ? (c.type === "fixed" ? c.value / 100 : c.value) : ""} required />
          </Field>
          <Field label="Max discount ₹" hint="Optional cap">
            <Input name="maxDiscount" inputMode="decimal" defaultValue={c?.maxDiscountPaise != null ? c.maxDiscountPaise / 100 : ""} />
          </Field>
        </div>
        <Field label="Description shown to customers">
          <Input name="description" defaultValue={c?.description} placeholder="e.g. ₹50 off on orders of ₹499 or more…" />
        </Field>
      </Section>
      <Section title="Limits & dates">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Minimum eligible subtotal ₹">
            <Input name="minSubtotal" inputMode="decimal" defaultValue={c ? c.minSubtotalPaise / 100 : 0} />
          </Field>
          <Field label="Total uses" hint="Blank = unlimited">
            <Input name="usageLimit" type="number" min={1} defaultValue={c?.usageLimit ?? ""} />
          </Field>
          <Field label="Uses per customer" hint="Blank = unlimited">
            <Input name="perCustomerLimit" type="number" min={1} defaultValue={c?.perCustomerLimit ?? ""} />
          </Field>
          <Field label="Starts" hint="Blank = immediately">
            <Input name="startsAt" type="datetime-local" defaultValue={d(c?.startsAt)} />
          </Field>
          <Field label="Ends" hint="Blank = no end date">
            <Input name="endsAt" type="datetime-local" defaultValue={d(c?.endsAt)} />
          </Field>
        </div>
      </Section>
      <Section title="Applies to">
        <ChipSelect name="categories" label="Categories" options={opts(cats)} defaultValue={c?.eligibleCategoryIds.map(String)} />
        <ChipSelect name="brands" label="Brands" options={opts(brands)} defaultValue={c?.eligibleBrandIds.map(String)} />
        <ChipSelect name="products" label="Products" options={products} defaultValue={c?.eligibleProductIds.map(String)} searchable />
        <p className="text-xs text-ink-500">Nothing selected anywhere = every product. Otherwise an item qualifies if it matches any selected category, brand or product.</p>
      </Section>
      <Section title="Rules">
        <div className="grid gap-2 md:grid-cols-3">
          <Toggle name="active" label="Active" hint="Customers can apply it" defaultChecked={c ? c.active : true} />
          <Toggle name="firstOrderOnly" label="First order only" hint="New customers only" defaultChecked={c?.firstOrderOnly} />
          <Toggle name="showOnStorefront" label="Show on homepage" hint="Listed under Offers" defaultChecked={c?.showOnStorefront} />
        </div>
      </Section>
      <Button size="lg" className="w-full sm:w-auto">
        {c ? "Save coupon" : "Create coupon"}
      </Button>
    </ActionForm>
  );
}

export default async function Coupons() {
  await requireAdmin();
  const [coupons, products, cats, brands] = await Promise.all([
    C.coupons.find({}).sort({ createdAt: -1 }).toArray(),
    C.products.find({ status: "active" }, { projection: { name: 1, brandId: 1 } }).sort({ name: 1 }).toArray(),
    C.categories.find({}).toArray(),
    C.brands.find({}).toArray(),
  ]);
  const productOpts = products.map((p) => ({ value: String(p._id), label: `${p.name} · ${brands.find((b) => b._id.equals(p.brandId))?.name ?? ""}` }));
  return (
    <div className="space-y-4">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900">Coupons</h1>
      <Card className="p-4 text-sm text-ink-700">
        Rules: one coupon per order. The minimum is checked against eligible items. Discount = fixed amount or percent of eligible items, capped by “max discount”, never more than the eligible items cost. Delivery is free when the subtotal <b>after</b> the discount reaches the free-delivery threshold.
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">New coupon</h2>
        <CouponForm cats={cats} brands={brands} products={productOpts} />
      </Card>
      {coupons.map((c) => (
        <Card key={String(c._id)} className="space-y-2 p-4">
          <p className="flex flex-wrap items-center gap-2">
            <b className="font-mono text-lg">{c.code}</b>
            <Badge tone={c.active ? "good" : "neutral"}>{c.active ? "active" : "inactive"}</Badge>
            <span className="text-sm text-ink-500">
              {c.type === "fixed" ? rupees(c.value) : `${c.value}%`} off · used {c.usedCount}
              {c.usageLimit ? `/${c.usageLimit}` : ""}
            </span>
          </p>
          <Disclosure label="Edit">
            <CouponForm c={c} cats={cats} brands={brands} products={productOpts} />
          </Disclosure>
        </Card>
      ))}
    </div>
  );
}
