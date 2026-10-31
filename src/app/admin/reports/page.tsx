import { Card } from "@/components/ui";
import { rupees } from "@/lib/money";
import { ORDER_LABEL } from "@/lib/order-rules";
import { requireAdmin } from "@/lib/session";
import type { OrderStatus } from "@/lib/types";
import { range, salesReport } from "@/server/reports";

export const metadata = { title: "Reports" };

const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export default async function Reports({ searchParams }: PageProps<"/admin/reports">) {
  await requireAdmin();
  const { from, to } = range(await searchParams);
  const r = await salesReport(from, to);
  const ev = (t: string) => r.events.find((e) => e._id === t);
  const q = `from=${day(from)}&to=${day(to)}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-burgundy-700">Reports</h1>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <label>
            From <input type="date" name="from" defaultValue={day(from)} className="h-10 rounded-xl border border-cream-300 bg-white px-2" />
          </label>
          <label>
            To <input type="date" name="to" defaultValue={day(to)} className="h-10 rounded-xl border border-cream-300 bg-white px-2" />
          </label>
          <button className="h-10 rounded-xl bg-burgundy-600 px-4 font-semibold text-white">Apply</button>
        </form>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4 text-sm">
          <h2 className="mb-2 font-semibold">Orders placed (excluding cancelled)</h2>
          <dl className="space-y-1">
            {(
              [
                ["Orders", r.totals?.n ?? 0, false],
                ["Item value", r.totals?.items ?? 0, true],
                ["Coupon discounts", r.totals?.discounts ?? 0, true],
                ["Delivery charges", r.totals?.delivery ?? 0, true],
                ["Order value (billed)", r.totals?.total ?? 0, true],
              ] as const
            ).map(([l, v, m]) => (
              <div key={l} className="flex justify-between">
                <dt>{l}</dt>
                <dd className="font-semibold tabular-nums">{m ? rupees(v) : v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-4 text-sm">
          <h2 className="mb-2 font-semibold">Money (by event date)</h2>
          <dl className="space-y-1">
            {[
              ["UPI payments verified", ev("upi_verified")],
              ["COD collected by partners", ev("cod_collected")],
              ["COD settled with shop", ev("cod_reconciled")],
              ["Refunds initiated", ev("refund_initiated")],
              ["Refunds completed", ev("refund_completed")],
            ].map(([l, e]) => (
              <div key={l as string} className="flex justify-between">
                <dt>{l as string}</dt>
                <dd className="font-semibold tabular-nums">
                  {rupees((e as { amount: number } | undefined)?.amount ?? 0)} <span className="text-xs text-ink-500">({(e as { n: number } | undefined)?.n ?? 0})</span>
                </dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-cream-200 pt-1">
              <dt>Unsettled COD right now</dt>
              <dd className="font-semibold tabular-nums">
                {rupees(r.unsettled?.sum ?? 0)} ({r.unsettled?.n ?? 0})
              </dd>
            </div>
          </dl>
        </Card>
        <Card className="p-4 text-sm">
          <h2 className="mb-2 font-semibold">Orders by status</h2>
          {r.byStatus.map((s) => (
            <p key={s._id} className="flex justify-between">
              <span>{ORDER_LABEL[s._id as OrderStatus]}</span>
              <span className="tabular-nums">
                {s.n} · {rupees(s.value)}
              </span>
            </p>
          ))}
        </Card>
        <Card className="p-4 text-sm">
          <h2 className="mb-2 font-semibold">Stock movements (units)</h2>
          {r.moves.map((m) => (
            <p key={m._id} className="flex justify-between">
              <span>{m._id}</span>
              <span className="tabular-nums">{m.qty}</span>
            </p>
          ))}
        </Card>
        <Card className="p-4 text-sm md:col-span-2">
          <h2 className="mb-2 font-semibold">Top products</h2>
          {r.top.map((t) => (
            <p key={t._id} className="flex justify-between">
              <span>{t._id}</span>
              <span className="tabular-nums">
                {t.qty} · {rupees(t.value)}
              </span>
            </p>
          ))}
        </Card>
      </div>
      <Card className="flex flex-wrap gap-2 p-4 text-sm">
        <span className="self-center font-semibold">Download CSV:</span>
        {["orders", "payments", "stock"].map((t) => (
          <a key={t} href={`/admin/reports/export?type=${t}&${q}`} className="rounded-lg bg-cream-200 px-3 py-1.5 font-semibold">
            {t}
          </a>
        ))}
      </Card>
    </div>
  );
}
