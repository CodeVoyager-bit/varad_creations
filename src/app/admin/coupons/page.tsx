import { saveCouponA } from "@/app/actions/admin";
import { ActionForm, Disclosure } from "@/components/admin-ui";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { C } from "@/lib/db";
import { rupees } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import type { CouponDoc } from "@/lib/types";

export const metadata = { title: "Coupons" };

const d = (x?: Date | null) => (x ? x.toISOString().slice(0, 16) : "");

type Named = { _id: import("mongodb").ObjectId; name: string };

function CouponForm({ c, cats, brands, products }: { c?: CouponDoc; cats: Named[]; brands: Named[]; products: Named[] }) {
  return (
    <ActionForm action={saveCouponA} resetOnSuccess={!c} className="grid gap-2 sm:grid-cols-4">
      {c && <input type="hidden" name="id" value={String(c._id)} />}
      <Field label="Code">
        <Input name="code" defaultValue={c?.code} required className="uppercase" />
      </Field>
      <Field label="Type">
        <Select name="type" defaultValue={c?.type ?? "fixed"}>
          <option value="fixed">Fixed ₹ off</option>
          <option value="percent">Percent off</option>
        </Select>
      </Field>
      <Field label="Value (₹ or %)">
        <Input name="value" defaultValue={c ? (c.type === "fixed" ? c.value / 100 : c.value) : ""} required />
      </Field>
      <Field label="Max discount ₹ (optional)">
        <Input name="maxDiscount" defaultValue={c?.maxDiscountPaise != null ? c.maxDiscountPaise / 100 : ""} />
      </Field>
      <Field label="Min. eligible subtotal ₹">
        <Input name="minSubtotal" defaultValue={c ? c.minSubtotalPaise / 100 : 0} />
      </Field>
      <Field label="Total uses (blank = unlimited)">
        <Input name="usageLimit" type="number" min={1} defaultValue={c?.usageLimit ?? ""} />
      </Field>
      <Field label="Uses per customer">
        <Input name="perCustomerLimit" type="number" min={1} defaultValue={c?.perCustomerLimit ?? ""} />
      </Field>
      <Field label="Description (shown to customers)">
        <Input name="description" defaultValue={c?.description} />
      </Field>
      <Field label="Starts">
        <Input name="startsAt" type="datetime-local" defaultValue={d(c?.startsAt)} />
      </Field>
      <Field label="Ends">
        <Input name="endsAt" type="datetime-local" defaultValue={d(c?.endsAt)} />
      </Field>
      <Field label="Only these categories" hint="None selected = all">
        <select name="categories" multiple defaultValue={c?.eligibleCategoryIds.map(String)} className="h-24 w-full rounded-xl border border-cream-300 bg-white text-sm">
          {cats.map((x) => (
            <option key={String(x._id)} value={String(x._id)}>
              {x.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Only these brands">
        <select name="brands" multiple defaultValue={c?.eligibleBrandIds.map(String)} className="h-24 w-full rounded-xl border border-cream-300 bg-white text-sm">
          {brands.map((x) => (
            <option key={String(x._id)} value={String(x._id)}>
              {x.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Only these products" className="sm:col-span-2">
        <select name="products" multiple defaultValue={c?.eligibleProductIds.map(String)} className="h-24 w-full rounded-xl border border-cream-300 bg-white text-sm">
          {products.map((x) => (
            <option key={String(x._id)} value={String(x._id)}>
              {x.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap items-center gap-4 text-sm sm:col-span-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={c ? c.active : true} className="accent-burgundy-600" /> Active
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="firstOrderOnly" defaultChecked={c?.firstOrderOnly} className="accent-burgundy-600" /> First order only
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="showOnStorefront" defaultChecked={c?.showOnStorefront} className="accent-burgundy-600" /> Show in Offers on homepage
        </label>
        <Button size="sm">{c ? "Save coupon" : "Create coupon"}</Button>
      </div>
    </ActionForm>
  );
}

export default async function Coupons() {
  await requireAdmin();
  const [coupons, products, cats, brands] = await Promise.all([
    C.coupons.find({}).sort({ createdAt: -1 }).toArray(),
    C.products.find({ status: "active" }, { projection: { name: 1 } }).sort({ name: 1 }).toArray(),
    C.categories.find({}).toArray(),
    C.brands.find({}).toArray(),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-burgundy-700">Coupons</h1>
      <Card className="p-4 text-sm text-ink-700">
        Rules: one coupon per order. The minimum is checked against eligible items. Discount = fixed amount or percent of eligible items, capped by “max discount”, never more than the eligible items cost. Delivery is free when the subtotal <b>after</b> the discount reaches the free-delivery threshold.
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">New coupon</h2>
        <CouponForm cats={cats} brands={brands} products={products} />
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
            <CouponForm c={c} cats={cats} brands={brands} products={products} />
          </Disclosure>
        </Card>
      ))}
    </div>
  );
}
