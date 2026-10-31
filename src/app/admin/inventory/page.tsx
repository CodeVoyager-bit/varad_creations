import Link from "next/link";
import { Badge, cx, fmtDate } from "@/components/ui";
import { C } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { nowMs } from "@/server/core";

export const metadata = { title: "Inventory" };

export default async function Inventory({ searchParams }: PageProps<"/admin/inventory">) {
  await requireAdmin();
  const filter = String((await searchParams).filter ?? "all");
  const in45 = new Date(nowMs() + 45 * 86400_000);
  const [variants, products, expiring, segregated] = await Promise.all([
    C.variants.find(filter === "low" ? { active: true, $expr: { $lte: ["$available", "$lowStockThreshold"] } } : {}).toArray(),
    C.products.find({}, { projection: { name: 1 } }).toArray(),
    C.batches.find({ status: "sellable", qty: { $gt: 0 }, expiryDate: { $lt: in45 } }).sort({ expiryDate: 1 }).toArray(),
    C.batches.find({ status: { $in: ["damaged", "expired", "returned"] }, qty: { $gt: 0 } }).sort({ receivedAt: -1 }).toArray(),
  ]);
  const name = (pid: unknown) => products.find((p) => String(p._id) === String(pid))?.name ?? "?";
  const vname = (vid: unknown) => {
    const v = variants.find((x) => String(x._id) === String(vid));
    return v ? `${name(v.productId)} ${v.label}` : String(vid);
  };
  const tabs = [
    ["all", "All stock"],
    ["low", "Low stock"],
    ["expiring", "Expiring ≤ 45 days"],
    ["segregated", "Damaged / expired / returned"],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900">Inventory</h1>
      <nav className="flex flex-wrap gap-1">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/admin/inventory?filter=${k}`} className={cx("rounded-full px-3 py-1.5 text-sm font-semibold", filter === k ? "bg-burgundy-600 text-white" : "bg-white")}>
            {l}
          </Link>
        ))}
      </nav>
      {(filter === "all" || filter === "low") && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-cream-200 text-left text-xs uppercase text-ink-500">
              <tr>
                <th className="p-3">Product / pack</th>
                <th className="p-3 text-right">Available</th>
                <th className="p-3 text-right">Held for orders</th>
                <th className="p-3 text-right">On shelf</th>
                <th className="p-3">Alert at</th>
              </tr>
            </thead>
            <tbody>
              {variants
                .sort((a, b) => a.available - a.lowStockThreshold - (b.available - b.lowStockThreshold))
                .map((v) => (
                  <tr key={String(v._id)} className="border-b border-cream-100 hover:bg-cream-50">
                    <td className="p-3">
                      <Link href={`/admin/inventory/${v._id}`} className="font-semibold text-burgundy-700 hover:underline">
                        {name(v.productId)} · {v.label}
                      </Link>
                      {!v.active && <Badge className="ml-2">off sale</Badge>}
                    </td>
                    <td className={cx("p-3 text-right tabular-nums", v.available <= v.lowStockThreshold && "font-bold text-saffron-700")}>{v.available}</td>
                    <td className="p-3 text-right tabular-nums">{v.reserved}</td>
                    <td className="p-3 text-right tabular-nums">{v.available + v.reserved}</td>
                    <td className="p-3 text-ink-500">{v.lowStockThreshold}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {filter === "expiring" && (
        <ul className="space-y-2">
          {expiring.map((b) => (
            <li key={String(b._id)} className="flex justify-between rounded-xl bg-white p-3 text-sm shadow-sm">
              <Link href={`/admin/inventory/${b.variantId}`} className="font-semibold text-burgundy-700">
                {vname(b.variantId)} · batch {b.batchNo}
              </Link>
              <span className={b.expiryDate! < new Date() ? "font-bold text-danger-600" : "text-saffron-700"}>
                {b.qty} pcs · expires {fmtDate(b.expiryDate, false)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {filter === "segregated" && (
        <ul className="space-y-2">
          {segregated.map((b) => (
            <li key={String(b._id)} className="flex justify-between rounded-xl bg-white p-3 text-sm shadow-sm">
              <Link href={`/admin/inventory/${b.variantId}`} className="font-semibold text-burgundy-700">
                {vname(b.variantId)} · batch {b.batchNo}
              </Link>
              <span>
                <Badge tone={b.status === "returned" ? "warn" : "bad"}>{b.status}</Badge> {b.qty} pcs · {b.note}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
