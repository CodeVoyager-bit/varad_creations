import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminMobileNav, AdminRail, AdminTopNav } from "@/components/admin-nav";
import { Icon, PageLoading } from "@/components/ui";
import { C } from "@/lib/db";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

// private, per-request pages: blocking navigation is fine and nothing here belongs in a static shell
export const instant = false;

/** Bell + profile chip. Reads the session itself so the setup-only security page still renders. */
async function HeaderChips() {
  const s = await getSession();
  if (s?.user.role !== "admin") return null;
  const [verify, accept, exceptions, support] = await Promise.all([
    C.orders.countDocuments({ paymentStatus: "verification_pending" }),
    C.orders.countDocuments({ status: "placed", paymentStatus: { $in: ["paid", "cod_due"] } }),
    C.orders.countDocuments({ exception: { $nin: [null, undefined] } as never, status: { $ne: "delivered" } }),
    C.support.countDocuments({ status: "open" }),
  ]);
  const todo = verify + accept + exceptions + support;
  return (
    <div className="flex items-center gap-2">
      <Link href="/admin" aria-label={todo ? `${todo} items need attention` : "Nothing needs attention"} className="relative grid size-11 place-items-center rounded-full bg-white text-ink-700 ring-1 ring-black/5 hover:text-ink-900">
        <Icon name="bell" className="size-5" />
        {todo > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-burgundy-600 px-1 text-[11px] font-bold text-white">{todo}</span>}
      </Link>
      <Link href="/admin/security" className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-1 ring-1 ring-black/5 hover:bg-cream-50 sm:pr-4">
        <span aria-hidden className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-saffron-400 to-burgundy-600 text-sm font-bold text-white">
          {s.user.name.trim()[0]?.toUpperCase()}
        </span>
        <span className="hidden leading-tight sm:block">
          <b className="block text-sm text-ink-900">{s.user.name}</b>
          <span className="text-xs text-ink-500">Admin</span>
        </span>
      </Link>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--color-canvas)] [--radius-card:1.5rem] [--shadow-card:0_1px_2px_rgb(36_23_15/0.04)]">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-30 bg-[var(--color-canvas)]/90 px-3 pb-2 pt-[calc(0.75rem+var(--safe-top))] backdrop-blur-md md:px-5">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-4 ring-1 ring-black/5">
            <span aria-hidden className="grid size-9 place-items-center rounded-full bg-burgundy-600 font-display text-lg font-bold text-white">
              V
            </span>
            <span className="font-display text-[15px] font-semibold text-ink-900">Varad</span>
          </Link>
          <Suspense fallback={<span className="hidden h-12 w-[30rem] rounded-full bg-white/60 md:block" />}>
            <AdminTopNav />
          </Suspense>
          <div className="ml-auto flex items-center gap-2">
            <form action="/admin/orders" role="search" className="hidden h-11 items-center gap-2 rounded-full bg-white px-4 ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-ink-900/20 xl:flex">
              <Icon name="search" className="size-4 text-ink-500" />
              <input name="q" type="search" placeholder="Order #, phone, UTR…" aria-label="Search orders" autoComplete="off" className="w-44 bg-transparent text-sm outline-none placeholder:text-ink-500" />
            </form>
            <Suspense fallback={<span className="block size-11 rounded-full bg-white/60" />}>
              <HeaderChips />
            </Suspense>
          </div>
        </div>
        <Suspense>
          <AdminMobileNav />
        </Suspense>
      </header>
      <div className="flex gap-5 px-3 pb-16 pt-3 md:px-5">
        <Suspense>
          <AdminRail />
        </Suspense>
        <main id="admin-main" className="min-w-0 flex-1">
          <Suspense fallback={<PageLoading />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
