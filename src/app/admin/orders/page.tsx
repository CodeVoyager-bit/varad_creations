import Link from "next/link";
import type { Filter } from "mongodb";
import { StatusBadges } from "@/components/order-bits";
import { cx, EmptyState, fmtDate } from "@/components/ui";
import { C, plain } from "@/lib/db";
import { rupees } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import type { OrderDoc } from "@/lib/types";
import { escapeRegex } from "@/server/core";

export const metadata = { title: "Orders" };

const TABS: [string, string, (now: Date) => Filter<OrderDoc>][] = [
  ["all", "All", () => ({})],
  ["new", "New", () => ({ status: "placed" })],
  ["accept", "To accept", () => ({ status: "placed", paymentStatus: { $in: ["paid", "cod_due"] } })],
  ["packing", "Packing", () => ({ status: { $in: ["confirmed", "packing"] } })],
  ["ready", "Ready for dispatch", () => ({ status: { $in: ["ready_for_dispatch", "rescheduled"] } })],
  ["out", "Out for delivery", () => ({ status: "out_for_delivery" })],
  ["failed", "Failed attempts", () => ({ status: "delivery_failed" })],
  ["delayed", "Delayed", (now) => ({ status: { $nin: ["delivered", "cancelled"] }, expectedBy: { $lt: now } })],
  ["exceptions", "Exceptions", () => ({ exception: { $nin: [null, undefined] } as never, status: { $ne: "delivered" } })],
  ["done", "Delivered", () => ({ status: "delivered" })],
  ["cancelled", "Cancelled", () => ({ status: "cancelled" })],
];

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.find((t) => t[0] === sp.tab) ?? TABS[0];
  const q = String(sp.q ?? "").trim().slice(0, 40);
  const filter: Filter<OrderDoc> = { ...tab[2](new Date()) };
  if (q) {
    const rx = new RegExp(escapeRegex(q.replace(/^#/, "")), "i");
    filter.$or = [{ number: rx }, { "address.phone": rx }, { "address.name": rx }, { "upi.reference": rx }];
  }
  const orders = plain(await C.orders.find(filter).sort({ createdAt: -1 }).limit(200).toArray());
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900">Orders</h1>
        <form className="flex gap-2">
          <input type="hidden" name="tab" value={tab[0]} />
          <input name="q" defaultValue={q} placeholder="Order #, phone, name, UTR" className="h-10 w-64 rounded-xl border border-cream-300 bg-white px-3 text-sm" aria-label="Search orders" />
          <button className="h-10 rounded-xl bg-burgundy-600 px-4 text-sm font-semibold text-white">Search</button>
        </form>
      </div>
      <nav className="scrollbar-none flex gap-1 overflow-x-auto" aria-label="Order filters">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/admin/orders?tab=${k}`} aria-current={k === tab[0] ? "page" : undefined} className={cx("shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold", k === tab[0] ? "bg-burgundy-600 text-white" : "bg-white text-ink-700")}>
            {l}
          </Link>
        ))}
      </nav>
      {orders.length ? (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-cream-200 text-left text-xs uppercase text-ink-500">
              <tr>
                <th className="p-3">Order</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Items</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Due by</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id} className="border-b border-cream-100 last:border-0 hover:bg-cream-50">
                  <td className="p-3">
                    <Link href={`/admin/orders/${o._id}`} className="font-semibold text-burgundy-700 hover:underline">
                      #{o.number}
                    </Link>
                    <span className="block text-xs text-ink-500">{fmtDate(o.createdAt)}</span>
                    {o.exception && <span className="block text-xs font-semibold text-danger-600">⚠ exception</span>}
                  </td>
                  <td className="p-3">
                    {o.address.name}
                    <span className="block text-xs text-ink-500">
                      {o.address.phone} · {o.address.pincode}
                    </span>
                  </td>
                  <td className="p-3 text-ink-700">{o.items.reduce((a, i) => a + i.qty, 0)} pcs</td>
                  <td className="p-3">
                    <StatusBadges o={o} />
                    <span className="mt-1 block text-xs uppercase text-ink-500">{o.paymentMethod}</span>
                  </td>
                  <td className="p-3 text-right font-semibold tabular-nums">{rupees(o.pricing.totalPaise)}</td>
                  <td className={cx("p-3 text-xs", o.expectedBy && new Date(o.expectedBy) < new Date() && !["delivered", "cancelled"].includes(o.status) ? "font-semibold text-danger-600" : "text-ink-500")}>
                    {o.expectedBy ? fmtDate(o.expectedBy) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No orders here" />
      )}
    </div>
  );
}
