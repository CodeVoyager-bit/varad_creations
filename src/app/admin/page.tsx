import Link from "next/link";
import { resolveAlert } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin-ui";
import { DailyBars, type Day } from "@/components/daily-bars";
import { StatusBadges } from "@/components/order-bits";
import { cx, fmtDate, Icon } from "@/components/ui";
import { C, plain } from "@/lib/db";
import { rupees } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { launchGaps } from "@/lib/settings-defaults";
import { nowMs } from "@/server/core";
import { processReservationExpiries } from "@/server/orders";
import { loadSettings } from "@/server/settings";

export const metadata = { title: "Overview" };

const DAY = 86400_000;
const OPEN = { $nin: ["delivered", "cancelled"] as ("delivered" | "cancelled")[] };
const istDay = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

async function received(from: Date, to: Date) {
  const rows = await C.paymentEvents
    .aggregate<{ _id: string; sum: number }>([{ $match: { at: { $gte: from, $lt: to }, type: { $in: ["upi_verified", "cod_collected", "refund_completed"] } } }, { $group: { _id: "$type", sum: { $sum: "$amountPaise" } } }])
    .toArray();
  const get = (t: string) => rows.find((r) => r._id === t)?.sum ?? 0;
  return get("upi_verified") + get("cod_collected") - get("refund_completed");
}

function Tile({ href, label, value, icon, hint }: { href: string; label: string; value: number; icon: Parameters<typeof Icon>[0]["name"]; hint: string }) {
  return (
    <Link href={href} className="group flex flex-col justify-between rounded-[1.5rem] bg-white p-4 ring-1 ring-black/5 transition-shadow hover:shadow-[0_10px_30px_-14px_rgb(36_23_15/0.3)]">
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm text-ink-700">{label}</span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cream-100 text-ink-700 group-hover:bg-ink-900 group-hover:text-white">
          <Icon name={icon} className="size-4" />
        </span>
      </span>
      <span className="mt-4">
        <b className="block text-3xl font-semibold tabular-nums tracking-tight text-ink-900">{value}</b>
        <span className="text-xs text-ink-500">{hint}</span>
      </span>
    </Link>
  );
}

export default async function Overview() {
  const user = await requireAdmin();
  await processReservationExpiries(); // request-time safety net alongside the cron
  const now = nowMs();
  const today = istDay(now);
  const startToday = new Date(`${today}T00:00:00+05:30`);
  const in45 = new Date(now + 45 * DAY);
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const days14 = Array.from({ length: 14 }, (_, i) => istDay(now - (13 - i) * DAY));

  const [verify, toAccept, packing, ready, outNow, delayed, exceptions, supportOpen, lowStock, expiring, alerts, unpaid, unsettled, week, prevWeek, todayIn, daily, recent, settings] = await Promise.all([
    C.orders.countDocuments({ paymentStatus: "verification_pending" }),
    C.orders.countDocuments({ status: "placed", paymentStatus: { $in: ["paid", "cod_due"] } }),
    C.orders.countDocuments({ status: { $in: ["confirmed", "packing"] } }),
    C.orders.countDocuments({ status: { $in: ["ready_for_dispatch", "rescheduled"] }, "delivery.batchId": null }),
    C.orders.countDocuments({ status: "out_for_delivery" }),
    C.orders.countDocuments({ status: OPEN, expectedBy: { $lt: new Date(now) } }),
    C.orders.countDocuments({ exception: { $nin: [null, undefined] } as never, status: { $ne: "delivered" } }),
    C.support.countDocuments({ status: "open" }),
    C.variants.find({ active: true, $expr: { $lte: ["$available", "$lowStockThreshold"] } }).sort({ available: 1 }).limit(5).toArray(),
    C.batches.countDocuments({ status: "sellable", qty: { $gt: 0 }, expiryDate: { $lt: in45 } }),
    C.alerts.find({ resolved: false }).sort({ at: -1 }).limit(5).toArray(),
    C.orders.aggregate<{ sum: number }>([{ $match: { status: { $ne: "cancelled" }, paymentStatus: { $in: ["awaiting_payment", "verification_pending", "cod_due"] } } }, { $group: { _id: null, sum: { $sum: "$pricing.totalPaise" } } }]).toArray(),
    C.orders.aggregate<{ sum: number; n: number }>([{ $match: { "cod.recordedAt": { $exists: true }, "cod.reconciledAt": { $exists: false } } }, { $group: { _id: null, sum: { $sum: "$cod.collectedPaise" }, n: { $sum: 1 } } }]).toArray(),
    received(new Date(now - 7 * DAY), new Date(now)),
    received(new Date(now - 14 * DAY), new Date(now - 7 * DAY)),
    received(startToday, new Date(now)),
    C.orders
      .aggregate<{ _id: string; orders: number; value: number }>([
        { $match: { createdAt: { $gte: new Date(`${days14[0]}T00:00:00+05:30`) }, status: { $ne: "cancelled" } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } }, orders: { $sum: 1 }, value: { $sum: "$pricing.totalPaise" } } },
      ])
      .toArray(),
    C.orders.find({}).sort({ createdAt: -1 }).limit(6).toArray(),
    loadSettings(),
  ]);
  const lowNames = await C.products.find({ _id: { $in: lowStock.map((v) => v.productId) } }, { projection: { name: 1 } }).toArray();
  const gaps = launchGaps(settings);
  const needs = verify + toAccept + exceptions;
  const delta = prevWeek ? Math.round(((week - prevWeek) / prevWeek) * 100) : null;
  const days: Day[] = days14.map((key) => {
    const d = daily.find((x) => x._id === key);
    return { key, label: new Date(`${key}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }), orders: d?.orders ?? 0, valuePaise: d?.value ?? 0 };
  });
  const fortnight = days.reduce((a, d) => a + d.orders, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900 md:text-[2.125rem]">
            {greeting}, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-ink-500">
            {new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })} · {needs ? `${needs} ${needs === 1 ? "thing needs" : "things need"} you right now` : "You’re all caught up"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/products/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink-900 ring-1 ring-black/10 hover:bg-cream-50">
            <Icon name="plus" className="size-4" /> Add product
          </Link>
          <Link href="/admin/orders" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink-900 px-5 text-sm font-semibold text-white hover:bg-ink-700">
            View orders <Icon name="chevron" className="size-4" />
          </Link>
        </div>
      </div>

      {gaps.length > 0 && (
        <details className="group rounded-[1.5rem] bg-white p-4 ring-1 ring-saffron-400/50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-saffron-700">
              <Icon name="alert" className="size-4" /> Launch checklist · {gaps.length} item{gaps.length === 1 ? "" : "s"} missing
            </span>
            <Icon name="down" className="size-4 text-ink-500 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm text-ink-700 sm:grid-cols-2">
            {gaps.map((g) => (
              <li key={g} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-saffron-500" />
                {g}
              </li>
            ))}
          </ul>
          <Link href="/admin/settings" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-burgundy-700 underline">
            Fill in settings
          </Link>
        </details>
      )}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.05fr_1.3fr_1.25fr]">
        {/* money */}
        <section className="flex flex-col rounded-[1.5rem] bg-white p-5 ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-700">Received · last 7 days</h2>
            <span className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold text-ink-700">INR</span>
          </div>
          <p className="mt-3 text-[2.25rem] font-semibold leading-none tabular-nums tracking-tight text-ink-900">{rupees(week)}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
            {delta != null ? (
              <span className={cx("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold", delta >= 0 ? "bg-leaf-50 text-leaf-700" : "bg-danger-50 text-danger-600")}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
              </span>
            ) : null}
            {delta != null ? "vs the 7 days before" : `${rupees(todayIn)} today`}
          </p>
          <p className="mt-1 text-xs text-ink-500">Verified UPI + COD collected, minus refunds.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/admin/payments#cod" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-ink-900 text-sm font-semibold text-white hover:bg-ink-700">
              <Icon name="wallet" className="size-4" /> Settle COD
            </Link>
            <Link href="/admin/reports" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-cream-100 text-sm font-semibold text-ink-900 hover:bg-cream-200">
              <Icon name="chart" className="size-4" /> Reports
            </Link>
          </div>
          <dl className="mt-4 space-y-2 rounded-2xl bg-cream-50 p-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-ink-700">Unpaid order value</dt>
              <dd className="font-semibold tabular-nums">{rupees(unpaid[0]?.sum ?? 0)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-700">COD with partners ({unsettled[0]?.n ?? 0})</dt>
              <dd className="font-semibold tabular-nums">{rupees(unsettled[0]?.sum ?? 0)}</dd>
            </div>
          </dl>
        </section>

        {/* work queue */}
        <section aria-label="Work queue" className="grid grid-cols-2 gap-3">
          <Link
            href={verify ? "/admin/payments" : toAccept ? "/admin/orders?tab=accept" : "/admin/orders?tab=exceptions"}
            className="relative col-span-2 overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-burgundy-700 via-[#a63a2c] to-saffron-500 p-5 text-white shadow-[0_18px_40px_-20px_rgb(134_28_48/0.7)] sm:col-span-1"
          >
            <span aria-hidden className="absolute -right-10 -top-12 size-36 rounded-full bg-white/15" />
            <span className="relative block text-sm font-medium text-white/90">Needs you now</span>
            <b className="relative mt-3 block text-5xl font-semibold leading-none tabular-nums">{needs}</b>
            <span className="relative mt-3 block text-xs leading-relaxed text-white/90">
              {verify} to verify · {toAccept} to accept · {exceptions} exceptions
            </span>
          </Link>
          <Tile href="/admin/orders?tab=packing" label="To pack" value={packing} icon="box" hint="confirmed & packing" />
          <Tile href="/admin/delivery" label="Ready to dispatch" value={ready} icon="truck" hint="not yet in a batch" />
          <Tile href="/admin/orders?tab=out" label="Out for delivery" value={outNow} icon="nav" hint="with partners now" />
        </section>

        {/* trend */}
        <section className="rounded-[1.5rem] bg-white p-5 ring-1 ring-black/5 lg:col-span-2 xl:col-span-1">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-ink-700">Order value · last 14 days</h2>
              <p className="text-xs text-ink-500">
                {fortnight} order{fortnight === 1 ? "" : "s"} · excludes cancelled
              </p>
            </div>
            <Link href="/admin/reports" className="grid size-9 place-items-center rounded-full bg-cream-100 text-ink-700 hover:bg-ink-900 hover:text-white" aria-label="Open reports">
              <Icon name="chevron" className="size-4" />
            </Link>
          </div>
          <DailyBars days={days} />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <section className="rounded-[1.5rem] bg-white p-5 ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-medium text-ink-700">Watch list</h2>
          <ul className="space-y-1.5 text-sm">
            {[
              { href: "/admin/orders?tab=delayed", label: "Delayed past 48 hours", n: delayed, bad: true },
              { href: "/admin/support", label: "Open support requests", n: supportOpen, bad: false },
              { href: "/admin/inventory?filter=expiring", label: "Batches expiring ≤ 45 days", n: expiring, bad: false },
            ].map((x) => (
              <li key={x.label}>
                <Link href={x.href} className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 hover:bg-cream-50">
                  <span className="text-ink-700">{x.label}</span>
                  <b className={cx("tabular-nums", x.n && x.bad ? "text-danger-600" : "text-ink-900")}>{x.n}</b>
                </Link>
              </li>
            ))}
          </ul>
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-500">Low stock</h3>
          {lowStock.length ? (
            <ul className="space-y-1 text-sm">
              {lowStock.map((v) => (
                <li key={String(v._id)}>
                  <Link href={`/admin/inventory/${v._id}`} className="flex min-h-10 items-center justify-between gap-2 rounded-xl px-3 hover:bg-cream-50">
                    <span className="truncate text-ink-700">
                      {lowNames.find((p) => p._id.equals(v.productId))?.name} · {v.label}
                    </span>
                    <b className={cx("tabular-nums", v.available ? "text-saffron-700" : "text-danger-600")}>{v.available ? `${v.available} left` : "Out"}</b>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 text-sm text-ink-500">Everything is above its alert level.</p>
          )}
          {alerts.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm">
              {alerts.map((a) => (
                <li key={String(a._id)} className="flex items-start justify-between gap-2 rounded-xl bg-saffron-50 px-3 py-2">
                  <span className="text-ink-700">{a.message}</span>
                  <ActionButton size="sm" variant="ghost" action={resolveAlert.bind(null, String(a._id))}>
                    Resolve
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[1.5rem] bg-white p-5 ring-1 ring-black/5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-700">Recent orders</h2>
            <Link href="/admin/orders" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-900 hover:underline">
              All orders
            </Link>
          </div>
          {recent.length ? (
            <ul className="divide-y divide-cream-200">
              {plain(recent).map((o) => (
                <li key={o._id}>
                  <Link href={`/admin/orders/${o._id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-cream-50 sm:flex-nowrap">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cream-100 text-xs font-bold text-ink-700">{o.address.name.trim().slice(0, 2).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-sm text-ink-900">
                        #{o.number} · {o.address.name}
                      </b>
                      <span className="block truncate text-xs text-ink-500">
                        {fmtDate(o.createdAt)} · {o.items.reduce((a, i) => a + i.qty, 0)} items · {o.paymentMethod.toUpperCase()}
                      </span>
                    </span>
                    <StatusBadges o={o} />
                    <b className="w-20 text-right text-sm tabular-nums">{rupees(o.pricing.totalPaise)}</b>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">No orders yet. They’ll appear here as soon as customers check out.</p>
          )}
        </section>
      </div>
    </div>
  );
}
