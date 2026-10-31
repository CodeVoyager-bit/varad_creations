import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountView } from "@/components/account-view";
import { Badge, fmtDate, PageLoading } from "@/components/ui";
import { C, plain } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <h1 className="mb-3 font-display text-2xl font-semibold text-burgundy-700">My account</h1>
      <Suspense fallback={<PageLoading />}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const user = await requireUser("/account");
  const [addresses, tickets] = await Promise.all([
    C.addresses.find({ userId: user.id }).sort({ isDefault: -1, createdAt: -1 }).toArray(),
    C.support.find({ userId: user.id }).sort({ createdAt: -1 }).limit(20).toArray(),
  ]);
  return (
    <div className="space-y-4">
      {user.role !== "customer" && (
        <Link href={user.role === "admin" ? "/admin" : "/delivery"} className="block rounded-2xl bg-burgundy-600 p-4 font-semibold text-white">
          Open the {user.role === "admin" ? "admin portal" : "delivery app"} →
        </Link>
      )}
      <Link href="/orders" className="block rounded-2xl bg-white p-4 font-semibold shadow-[var(--shadow-card)]">
        My orders →
      </Link>
      <AccountView
        user={{ name: user.name, phone: user.phoneNumber ?? "" }}
        addresses={addresses.map(({ _id, userId: _u, createdAt: _c, ...a }) => ({ ...plain(a), id: _id.toHexString() }))}
      />
      {tickets.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-2 font-semibold">Your requests</h2>
          <ul className="space-y-2 text-sm">
            {tickets.map((t) => (
              <li key={t.ticket} className="rounded-xl bg-cream-100 px-3 py-2">
                <p className="flex justify-between gap-2">
                  <b>
                    {t.ticket}
                    {t.orderNumber ? ` · #${t.orderNumber}` : ""}
                  </b>
                  <Badge tone={t.status === "open" ? "warn" : "good"}>{t.status === "open" ? "Open" : "Resolved"}</Badge>
                </p>
                <p className="text-xs text-ink-500">{fmtDate(t.createdAt)}</p>
                <p className="text-ink-700">{t.message}</p>
                {t.resolution && <p className="mt-1 text-leaf-700">Shop: {t.resolution}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
