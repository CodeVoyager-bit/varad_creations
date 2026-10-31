import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBadges } from "@/components/order-bits";
import { ButtonLink, EmptyState, fmtDate, Icon, PageLoading } from "@/components/ui";
import { C, plain } from "@/lib/db";
import { rupees } from "@/lib/money";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <h1 className="mb-3 font-display text-2xl font-semibold text-burgundy-700">My orders</h1>
      <Suspense fallback={<PageLoading />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const user = await requireUser("/orders");
  const orders = plain(await C.orders.find({ userId: user.id }).sort({ createdAt: -1 }).limit(100).toArray());
  if (!orders.length) return <EmptyState title="No orders yet" body="Your orders will appear here." action={<ButtonLink href="/products">Start shopping</ButtonLink>} />;
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o._id}>
          <Link href={`/orders/${o._id}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                #{o.number} · {rupees(o.pricing.totalPaise)}
              </p>
              <p className="truncate text-sm text-ink-500">
                {fmtDate(o.createdAt)} · {o.items.map((i) => i.name).join(", ")}
              </p>
              <div className="mt-2">
                <StatusBadges o={o} />
              </div>
            </div>
            <Icon name="chevron" className="size-5 text-ink-300" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
