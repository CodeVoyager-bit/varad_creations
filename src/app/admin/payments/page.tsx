import Link from "next/link";
import { reconcile } from "@/app/actions/admin";
import { ActionForm, SelectAll } from "@/components/admin-ui";
import { Button, Card, EmptyState, fmtDate } from "@/components/ui";
import { C, plain } from "@/lib/db";
import { rupees } from "@/lib/money";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Payments" };

export default async function Payments() {
  await requireAdmin();
  const [verify, awaiting, exceptions, cod, refunds, partners] = await Promise.all([
    C.orders.find({ paymentStatus: "verification_pending" }).sort({ "upi.submittedAt": 1 }).toArray(),
    C.orders.find({ paymentStatus: "awaiting_payment", status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).limit(50).toArray(),
    C.orders.find({ exception: { $nin: [null, undefined] } as never, status: { $ne: "delivered" } }).toArray(),
    C.orders.find({ "cod.recordedAt": { $exists: true }, "cod.reconciledAt": { $exists: false } }).sort({ "cod.recordedAt": 1 }).toArray(),
    C.orders.find({ paymentStatus: "refund_pending" }).toArray(),
    C.users.find({ role: "delivery" }, { projection: { name: 1 } }).toArray(),
  ]);
  const partnerName = (id: string) => partners.find((p) => p._id.toHexString() === id)?.name ?? "partner";
  const row = (o: (typeof verify)[number], extra: React.ReactNode) => (
    <li key={String(o._id)} className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-100 py-2 last:border-0">
      <span className="text-sm">
        <Link href={`/admin/orders/${o._id}`} className="font-semibold text-burgundy-700 hover:underline">
          #{o.number}
        </Link>{" "}
        · {o.address.name} · {rupees(o.pricing.totalPaise)}
        <span className="block text-xs text-ink-500">{extra}</span>
      </span>
      <Link href={`/admin/orders/${o._id}`} className="rounded-lg bg-burgundy-600 px-3 py-1.5 text-sm font-semibold text-white">
        Open
      </Link>
    </li>
  );
  const codByPartner = Object.entries(
    cod.reduce<Record<string, typeof cod>>((m, o) => ((m[o.cod!.recordedBy] ??= []).push(o), m), {}),
  );
  return (
    <div className="space-y-4">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900">Payments</h1>
      <p className="text-sm text-ink-500">Customer “I have paid” submissions and screenshots are never proof. Mark a UPI payment received only after you see it in the bank or UPI business account.</p>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">UPI to verify ({verify.length})</h2>
        {verify.length ? <ul>{verify.map((o) => row(o, `UTR ${o.upi?.reference} · submitted ${fmtDate(o.upi?.submittedAt)}${o.upi?.proofFileId ? " · screenshot attached" : ""}`))}</ul> : <EmptyState title="Nothing to verify" />}
      </Card>
      {exceptions.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 font-semibold text-danger-600">Payment & stock exceptions ({exceptions.length})</h2>
          <ul>{exceptions.map((o) => row(o, o.exception))}</ul>
        </Card>
      )}
      <Card className="p-4" id="cod">
        <h2 className="mb-1 font-semibold">COD collections to settle ({cod.length})</h2>
        <p className="mb-2 text-xs text-ink-500">Delivery partners recorded these collections. Settle them only after you receive the cash / UPI transfer from the partner.</p>
        {codByPartner.length ? (
          codByPartner.map(([pid, list]) => (
            <ActionForm key={pid} action={reconcile} confirm="Confirm you have received this money from the partner." className="mb-3 rounded-xl border border-cream-200 p-3">
              <div id={`cod-${pid}`}>
                <p className="mb-1 flex items-center gap-2 font-semibold">
                  <SelectAll name="ids" formId={`cod-${pid}`} /> {partnerName(pid)} · {rupees(list.reduce((a, o) => a + o.cod!.collectedPaise, 0))}
                </p>
                {list.map((o) => (
                  <label key={String(o._id)} className="flex items-center gap-2 py-1 text-sm">
                    <input type="checkbox" name="ids" value={String(o._id)} className="accent-burgundy-600" />#{o.number} · {rupees(o.cod!.collectedPaise)} {o.cod!.method}
                    {o.cod!.reference ? ` (${o.cod!.reference})` : ""} · {fmtDate(o.cod!.recordedAt)}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input name="note" placeholder="Note (e.g. cash counted)" className="h-9 flex-1 rounded-lg border border-cream-300 px-2 text-sm" />
                <Button size="sm" variant="success">
                  Mark selected settled
                </Button>
              </div>
            </ActionForm>
          ))
        ) : (
          <EmptyState title="All collections settled" />
        )}
      </Card>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Refunds to complete ({refunds.length})</h2>
        {refunds.length ? <ul>{refunds.map((o) => row(o, `${rupees(o.refundPendingPaise)} pending`))}</ul> : <EmptyState title="No pending refunds" />}
      </Card>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Awaiting UPI payment ({awaiting.length})</h2>
        <ul>{plain(awaiting).length ? awaiting.map((o) => row(o, `window ends ${fmtDate(o.paymentDeadline)}`)) : <EmptyState title="None" />}</ul>
      </Card>
    </div>
  );
}
