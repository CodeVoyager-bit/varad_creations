"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

const LINKS: [string, string][] = [
  ["/admin", "Dashboard"],
  ["/admin/orders", "Orders"],
  ["/admin/payments", "Payments"],
  ["/admin/delivery", "Delivery"],
  ["/admin/products", "Products"],
  ["/admin/catalog", "Brands & categories"],
  ["/admin/inventory", "Inventory"],
  ["/admin/coupons", "Coupons"],
  ["/admin/customers", "Customers"],
  ["/admin/support", "Support"],
  ["/admin/storefront", "Storefront"],
  ["/admin/content", "Policies & SEO"],
  ["/admin/settings", "Settings"],
  ["/admin/reports", "Reports"],
  ["/admin/audit", "Audit log"],
  ["/admin/security", "Security"],
];

export function AdminNav() {
  const path = usePathname();
  const active = (h: string) => (h === "/admin" ? path === h : path.startsWith(h));
  return (
    <>
      <header className="no-print sticky top-0 z-30 border-b border-cream-300 bg-white pt-[var(--safe-top)] md:hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <Link href="/admin" className="font-display text-lg font-semibold text-burgundy-700">
            Varad Admin
          </Link>
          <Link href="/" className="text-sm font-semibold text-ink-500">
            View store
          </Link>
        </div>
        <nav aria-label="Admin" className="scrollbar-none flex gap-1 overflow-x-auto px-2 pb-2">
          {LINKS.map(([h, l]) => (
            <Link key={h} href={h} aria-current={active(h) ? "page" : undefined} className={cx("shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold", active(h) ? "bg-burgundy-600 text-white" : "text-ink-700")}>
              {l}
            </Link>
          ))}
        </nav>
      </header>
      <aside className="no-print sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-cream-300 bg-white md:flex">
        <Link href="/admin" className="px-5 py-5 font-display text-xl font-semibold text-burgundy-700">
          Varad Admin
        </Link>
        <nav aria-label="Admin" className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {LINKS.map(([h, l]) => (
            <Link key={h} href={h} aria-current={active(h) ? "page" : undefined} className={cx("block rounded-lg px-3 py-2 text-sm font-semibold", active(h) ? "bg-burgundy-600 text-white" : "text-ink-700 hover:bg-cream-100")}>
              {l}
            </Link>
          ))}
        </nav>
        <Link href="/" className="px-6 py-4 text-sm font-semibold text-ink-500 hover:text-burgundy-700">
          View store →
        </Link>
      </aside>
    </>
  );
}
