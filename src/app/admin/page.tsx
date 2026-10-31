import Link from "next/link";
import { ActionButton } from "@/components/admin-ui";
import { Card, Icon, Notice } from "@/components/ui";
import { resolveAlert } from "@/app/actions/admin";
import { C } from "@/lib/db";
import { rupees } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { launchGaps } from "@/lib/settings-defaults";
import { processReservationExpiries } from "@/server/orders";
import { loadSettings } from "@/server/settings";

export const metadata = { title: "Dashboard" };

const OPEN = { $nin: ["delivered", "cancelled"] as ("delivered" | "cancelled")[] };

async function money(from: Date) {
  const rows = await C.paymentEvents
    .aggregate<{ _id: string; sum: number }>([{ $match: { at: { $gte: from }, type: { $in: ["upi_verified", "cod_collected", "refund_completed"] } } }, { $group: { _id: "$type", sum: { $sum: "$amountPaise" } } }])
    .toArray();
  const get = (t: string) => rows.find((r) => r._id === t)?.sum ?? 0;
  return { received: get("upi_verified") + get("cod_collected"), refunded: get("refund_completed") };
}

export default async function Dashboard() {
  await requireAdmin();
  await processReservationExpiries(); // request-time safety net alongside the cron
  const now = new Date();
  const startToday = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  startToday.setHours(0, 0, 0, 0);
  const in45 = new Date(now.getTime() + 45 * 86400_000);

  const [placedToday, verify, toAccept, packing, ready, outNow, delayed, exceptions, lowStock, expiring, alerts, supportOpen, unpaid, unsettled, today, week, month, settings] = await Promise.all([
    C.orders.countDocuments({ createdAt: { $gte: startToday } }),
    C.orders.countDocuments({ paymentStatus: "verification_pending" }),
    C.orders.countDocuments({ status: "placed", paymentStatus: { $in: ["paid", "cod_due"] } }),
    C.orders.countDocuments({ status: { $in: ["confirmed", "packing"] } }),
    C.orders.countDocuments({ status: { $in: ["ready_for_dispatch", "rescheduled"] }, "delivery.batchId": null }),
    C.orders.countDocuments({ status: "out_for_delivery" }),
    C.orders.countDocuments({ status: OPEN, expectedBy: { $lt: now } }),
    C.orders.countDocuments({ exception: { $nin: [null, undefined] }, status: { $ne: "delivered" } }),
    C.variants.countDocuments({ active: true, $expr: { $lte: ["$available", "$lowStockThreshold"] } }),
    C.batches.countDocuments({ status: "sellable", qty: { $gt: 0 }, expiryDate: { $lt: in45 } }),
    C.alerts.find({ resolved: false }).sort({ at: -1 }).limit(10).toArray(),
    C.support.countDocuments({ status: "open" }),
    C.orders.aggregate<{ sum: number }>([{ $match: { status: { $ne: "cancelled" }, paymentStatus: { $in: ["awaiting_payment", "verification_pending", "cod_due"] } } }, { $group: { _id: null, sum: { $sum: "$pricing.totalPaise" } } }]).toArray(),
    C.orders.aggregate<{ sum: number; n: number }>([{ $match: { "cod.recordedAt": { $exists: true }, "cod.reconciledAt": { $exists: false } } }, { $group: { _id: null, sum: { $sum: "$cod.collectedPaise" }, n: { $sum: 1 } } }]).toArray(),
    money(startToday),
    money(new Date(now.getTime() - 7 * 86400_000)),
    money(new Date(now.getTime() - 30 * 86400_000)),
    loadSettings(),
  ]);
  const gaps = launchGaps(settings);

  const tiles: [string, number, string, string][] = [
    ["New orders today", placedToday, "/admin/orders", "box"],
    ["Verify payments", verify, "/admin/payments", "wallet"],
    ["Awaiting acceptance", toAccept, "/admin/orders?tab=accept", "check"],
    ["To pack", packing, "/admin/orders?tab=packing", "box"],
    ["Ready, unassigned", ready, "/admin/delivery", "truck"],
    ["Out for delivery", outNow, "/admin/orders?tab=out", "nav"],
    ["Delayed (past 48h)", delayed, "/admin/orders?tab=delayed", "clock"],
    ["Exceptions", exceptions, "/admin/orders?tab=exceptions", "alert"],
    ["Low stock", lowStock, "/admin/inventory?filter=low", "alert"],
    ["Expiring ≤ 45 days", expiring, "/admin/inventory?filter=expiring", "clock"],
    ["Open support", supportOpen, "/admin/support", "phone"],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-burgundy-700">Today at Varad</h1>
        <p className="text-sm text-ink-500">{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}</p>
      </div>
      {gaps.length > 0 && (
        <Notice tone="warn" title={`Launch checklist: ${gaps.length} item(s) missing`}>
          <ul className="mt-1 list-disc pl-5">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          <Link href="/admin/settings" className="mt-1 inline-block font-semibold underline">
            Open settings
          </Link>
        </Notice>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(([label, n, href, icon]) => (
          <li key={label}>
            <Link href={href} className={`block rounded-2xl p-4 shadow-[var(--shadow-card)] ${n && /Verify|Exceptions|Delayed|acceptance/.test(label) ? "bg-saffron-50" : "bg-white"}`}>
              <Icon name={icon as "box"} className="size-5 text-burgundy-600" />
              <p className="mt-2 text-3xl font-bold tabular-nums">{n}</p>
              <p className="text-sm text-ink-700">{label} →</p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">Money received (verified UPI + recorded COD)</h2>
          <table className="w-full text-sm">
            <tbody>
              {(
                [
                  ["Today", today],
                  ["Last 7 days", week],
                  ["Last 30 days", month],
                ] as const
              ).map(([l, m]) => (
                <tr key={l} className="border-b border-cream-200 last:border-0">
                  <td className="py-1.5">{l}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{rupees(m.received)}</td>
                  <td className="py-1.5 text-right text-xs text-ink-500">{m.refunded ? `− ${rupees(m.refunded)} refunded` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="space-y-2 p-4 text-sm">
          <h2 className="font-semibold">Not yet money in hand</h2>
          <p className="flex justify-between">
            <span>Unpaid order value (awaiting UPI / verification / COD due)</span>
            <b className="tabular-nums">{rupees(unpaid[0]?.sum ?? 0)}</b>
          </p>
          <p className="flex justify-between">
            <span>COD collected by partners, not yet settled ({unsettled[0]?.n ?? 0})</span>
            <b className="tabular-nums">{rupees(unsettled[0]?.sum ?? 0)}</b>
          </p>
          <Link href="/admin/payments#cod" className="font-semibold text-burgundy-700 underline">
            Reconcile collections
          </Link>
        </Card>
      </div>
      {alerts.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">Inventory alerts</h2>
          <ul className="space-y-2 text-sm">
            {alerts.map((a) => (
              <li key={String(a._id)} className="flex items-start justify-between gap-3 rounded-xl bg-saffron-50 px-3 py-2">
                <span>{a.message}</span>
                <ActionButton size="sm" variant="ghost" action={resolveAlert.bind(null, String(a._id))}>
                  Resolve
                </ActionButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
