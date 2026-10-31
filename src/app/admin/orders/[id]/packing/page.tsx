import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { PrintButton } from "@/components/print-button";
import { fmtDate } from "@/components/ui";
import { C } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { nowMs } from "@/server/core";

export const metadata = { title: "Packing list" };

/** Pick earliest-expiry sellable batches first; flag anything with < 45 days left (FSSAI shelf-life rule). */
export default async function PackingList({ params }: PageProps<"/admin/orders/[id]/packing">) {
  await requireAdmin();
  const { id } = await params;
  const o = ObjectId.isValid(id) ? await C.orders.findOne({ _id: new ObjectId(id) }) : null;
  if (!o) notFound();
  const soon = nowMs() + 45 * 86400_000;
  const rows = await Promise.all(
    o.items.map(async (it) => {
      const batches = (await C.batches.find({ variantId: it.variantId, status: "sellable", qty: { $gt: 0 } }).toArray()).sort(
        (a, b) => (a.expiryDate?.getTime() ?? Infinity) - (b.expiryDate?.getTime() ?? Infinity) || a.receivedAt.getTime() - b.receivedAt.getTime(),
      );
      let left = it.qty;
      const pick = batches.flatMap((b) => {
        if (!left) return [];
        const n = Math.min(left, b.qty);
        left -= n;
        return [{ batchNo: b.batchNo, expiry: b.expiryDate, n, near: !!b.expiryDate && b.expiryDate.getTime() < soon }];
      });
      return { it, pick, short: left };
    }),
  );
  return (
    <article className="mx-auto max-w-2xl space-y-4 bg-white p-6 shadow-[var(--shadow-card)] print:shadow-none">
      <header className="flex justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Packing list · #{o.number}</h1>
          <p className="text-sm text-ink-500">
            {o.address.name} · {o.address.pincode} · {o.paymentMethod === "cod" ? "COD" : "Prepaid"}
          </p>
        </div>
        <PrintButton />
      </header>
      <table className="w-full text-sm">
        <thead className="border-b border-cream-300 text-left">
          <tr>
            <th className="py-2">✓</th>
            <th className="py-2">Item</th>
            <th className="py-2 pr-4 text-right">Qty</th>
            <th className="py-2">Pick from batch (earliest expiry first)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ it, pick, short }, i) => (
            <tr key={i} className="border-b border-cream-100 align-top">
              <td className="py-2">☐</td>
              <td className="py-2">
                <b>{it.brand}</b> {it.name} ({it.variantLabel})
              </td>
              <td className="py-2 pr-4 text-right font-bold">{it.qty}</td>
              <td className="py-2">
                {pick.map((p) => (
                  <span key={p.batchNo} className={`block ${p.near ? "font-semibold text-danger-600" : ""}`}>
                    {p.n} × {p.batchNo} {p.expiry ? `(exp ${fmtDate(p.expiry, false)})` : ""} {p.near && "⚠ under 45 days left"}
                  </span>
                ))}
                {short > 0 && <span className="block font-semibold text-danger-600">{short} unit(s) have no batch record — check shelf</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-ink-500">
        Check every pack: seal intact, label legible, expiry date OK. Stock is deducted only when you mark the order “Ready for dispatch”.
      </p>
    </article>
  );
}
