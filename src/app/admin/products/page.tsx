import Link from "next/link";
import { Badge, ButtonLink } from "@/components/ui";
import { C } from "@/lib/db";
import { rupees } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { escapeRegex } from "@/server/core";

export const metadata = { title: "Products" };

export default async function Products({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const q = String((await searchParams).q ?? "").trim().slice(0, 60);
  const products = await C.products.find(q ? { searchText: new RegExp(escapeRegex(q.toLowerCase())) } : {}).sort({ updatedAt: -1 }).limit(300).toArray();
  const [variants, brands, cats] = await Promise.all([
    C.variants.find({ productId: { $in: products.map((p) => p._id) } }).toArray(),
    C.brands.find({}).toArray(),
    C.categories.find({}).toArray(),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900">Products</h1>
        <div className="flex gap-2">
          <form>
            <input name="q" defaultValue={q} placeholder="Search" aria-label="Search products" className="h-10 rounded-xl border border-cream-300 bg-white px-3 text-sm" />
          </form>
          <ButtonLink href="/admin/products/new">+ New product</ButtonLink>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-cream-200 text-left text-xs uppercase text-ink-500">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Brand / category</th>
              <th className="p-3">Pack sizes</th>
              <th className="p-3">Stock (free / held)</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const vs = variants.filter((v) => v.productId.equals(p._id));
              const cat = cats.find((c) => c._id.equals(p.categoryId));
              return (
                <tr key={String(p._id)} className="border-b border-cream-100 hover:bg-cream-50">
                  <td className="p-3">
                    <Link href={`/admin/products/${p._id}`} className="font-semibold text-burgundy-700 hover:underline">
                      {p.name}
                    </Link>
                    {p.isDemo && <Badge className="ml-2">demo</Badge>}
                    {!p.images.length && <span className="block text-xs text-saffron-700">no photo</span>}
                    {p.kind === "food" && !p.food?.ingredients && <span className="block text-xs text-saffron-700">label info missing</span>}
                  </td>
                  <td className="p-3 text-ink-700">
                    {brands.find((b) => b._id.equals(p.brandId))?.name} / {cat?.name}
                    {cat && !cat.visible && <span className="block text-xs text-ink-500">category hidden</span>}
                  </td>
                  <td className="p-3">{vs.map((v) => `${v.label} ${rupees(v.pricePaise)}`).join(", ") || <span className="text-danger-600">none</span>}</td>
                  <td className="p-3 tabular-nums">
                    {vs.map((v) => (
                      <span key={String(v._id)} className={`block ${v.available <= v.lowStockThreshold ? "font-semibold text-saffron-700" : ""}`}>
                        {v.label}: {v.available} / {v.reserved}
                      </span>
                    ))}
                  </td>
                  <td className="p-3">
                    <Badge tone={p.status === "active" ? "good" : p.status === "draft" ? "neutral" : "bad"}>{p.status}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
