import { addressLines, Bill, type PlainOrder } from "./order-bits";
import { fmtDate } from "./ui";
import { rupees } from "@/lib/money";
import type { SettingsDoc } from "@/lib/settings-defaults";
import { PrintButton } from "./print-button";

/** Bill / cash memo. Carries the shop's FSSAI number as FSSAI requires on every bill. */
export function BillDoc({ o, s }: { o: PlainOrder; s: SettingsDoc }) {
  const a = s.address;
  return (
    <article className="mx-auto max-w-2xl bg-white p-6 text-sm shadow-[var(--shadow-card)] print:shadow-none">
      <header className="flex justify-between gap-4 border-b border-cream-300 pb-4">
        <div>
          <p className="font-display text-xl font-semibold text-burgundy-700">{s.legalName ?? s.businessName}</p>
          <p>
            {a.line1}
            {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
          </p>
          <p>Phone {s.phone}{s.email ? ` · ${s.email}` : ""}</p>
          <p>FSSAI Reg./Lic. No.: {s.fssaiLicence ?? <mark>to be added before launch</mark>}</p>
          {s.gstin && <p>GSTIN: {s.gstin}</p>}
        </div>
        <div className="text-right">
          <p className="font-semibold">Bill / Cash memo</p>
          <p>No. {o.number}</p>
          <p>{fmtDate(o.createdAt)}</p>
          <PrintButton />
        </div>
      </header>
      <section className="grid gap-4 py-4 sm:grid-cols-2">
        <div>
          <p className="font-semibold">Deliver to</p>
          {addressLines(o.address).map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
        <div className="sm:text-right">
          <p className="font-semibold">Payment</p>
          <p>{o.paymentMethod === "upi" ? `UPI${o.upi?.reference ? ` · Ref ${o.upi.reference}` : ""}` : `Cash on delivery${o.cod ? ` · collected by ${o.cod.method}` : ""}`}</p>
          {o.refundedPaise > 0 && <p>Refunded: {rupees(o.refundedPaise)}</p>}
        </div>
      </section>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-cream-300 text-left">
            <th className="py-2">Item</th>
            <th className="py-2 text-right">MRP</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((i, k) => (
            <tr key={k} className="border-b border-cream-200">
              <td className="py-1.5">
                {i.brand} {i.name} ({i.variantLabel})
              </td>
              <td className="py-1.5 text-right">{rupees(i.mrpPaise)}</td>
              <td className="py-1.5 text-right">{rupees(i.unitPricePaise)}</td>
              <td className="py-1.5 text-right">{i.qty}</td>
              <td className="py-1.5 text-right">{rupees(i.lineTotalPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-3 max-w-xs">
        <Bill p={o.pricing} />
      </div>
      <footer className="mt-6 space-y-1 border-t border-cream-300 pt-3 text-xs text-ink-500">
        <p>Prices are inclusive of all taxes (MRP). Delivery fee, if any, is a separate service charge shown above.</p>
        <p>
          Wrong, damaged, defective or expired items: contact us
          {s.policy.issueReportHours ? ` within ${s.policy.issueReportHours} hours of delivery` : ""}
          {s.policy.refundProcessingDays ? `; approved refunds are processed within ${s.policy.refundProcessingDays} days` : ""}. See our Cancellation & refund policy.
        </p>
      </footer>
    </article>
  );
}
