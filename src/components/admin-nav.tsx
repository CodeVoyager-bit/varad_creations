"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cx, Icon } from "./ui";

type IconName = Parameters<typeof Icon>[0]["name"];

/** Daily operations: the top pill bar. */
const PRIMARY: [string, string][] = [
  ["/admin", "Overview"],
  ["/admin/orders", "Orders"],
  ["/admin/payments", "Payments"],
  ["/admin/delivery", "Delivery"],
  ["/admin/inventory", "Inventory"],
  ["/admin/products", "Products"],
];

/** Setup and records: the side rail. */
const SECONDARY: [string, string, IconName][] = [
  ["/admin/catalog", "Catalog", "grid"],
  ["/admin/coupons", "Coupons", "tag"],
  ["/admin/customers", "Customers", "users"],
  ["/admin/support", "Support", "phone"],
  ["/admin/storefront", "Storefront", "store"],
  ["/admin/content", "Policies", "doc"],
  ["/admin/reports", "Reports", "chart"],
  ["/admin/audit", "Audit", "history"],
  ["/admin/settings", "Settings", "settings"],
  ["/admin/security", "Security", "shield"],
];

const useActive = () => {
  const path = usePathname();
  return (h: string) => (h === "/admin" ? path === h : path.startsWith(h));
};

export function AdminTopNav() {
  const active = useActive();
  return (
    <nav aria-label="Admin sections" className="hidden items-center gap-0.5 rounded-full bg-white p-1 ring-1 ring-black/5 md:flex">
      {PRIMARY.map(([h, l]) => (
        <Link
          key={h}
          href={h}
          aria-current={active(h) ? "page" : undefined}
          className={cx("rounded-full px-3.5 py-2 text-sm font-medium transition-colors lg:px-4", active(h) ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-cream-100")}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}

export function AdminRail() {
  const active = useActive();
  const router = useRouter();
  const item = (h: string, l: string, icon: IconName, on = active(h)) => (
    <Link
      key={h}
      href={h}
      aria-current={on ? "page" : undefined}
      className={cx("group flex w-full flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium", on ? "text-ink-900" : "text-ink-500 hover:text-ink-900")}
    >
      <span className={cx("grid size-9 place-items-center rounded-full transition-colors", on ? "bg-ink-900 text-white" : "group-hover:bg-cream-100")}>
        <Icon name={icon} className="size-5" />
      </span>
      {l}
    </Link>
  );
  return (
    <aside aria-label="Setup and records" className="no-print sticky top-24 hidden h-[calc(100dvh-7.5rem)] w-[4.75rem] shrink-0 flex-col gap-3 md:flex">
      <nav className="flex-1 overflow-y-auto rounded-[1.75rem] bg-white px-1.5 py-2 ring-1 ring-black/5 scrollbar-none">{SECONDARY.map(([h, l, i]) => item(h, l, i))}</nav>
      <div className="rounded-[1.75rem] bg-white px-1.5 py-2 ring-1 ring-black/5">
        {item("/", "Store", "store", false)}
        <button
          onClick={async () => {
            await authClient.signOut();
            router.replace("/login");
          }}
          className="group flex w-full cursor-pointer flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium text-ink-500 hover:text-danger-600"
        >
          <span className="grid size-10 place-items-center rounded-full group-hover:bg-danger-50">
            <Icon name="logout" className="size-5" />
          </span>
          Sign out
        </button>
      </div>
    </aside>
  );
}

/** Phones: one scrollable pill row with every section, operations first. */
export function AdminMobileNav() {
  const active = useActive();
  return (
    <nav aria-label="Admin sections" className="scrollbar-none -mx-3 mt-3 flex gap-1.5 overflow-x-auto px-3 pb-1 md:hidden">
      {[...PRIMARY, ...SECONDARY.map(([h, l]) => [h, l] as [string, string])].map(([h, l]) => (
        <Link
          key={h}
          href={h}
          aria-current={active(h) ? "page" : undefined}
          className={cx("shrink-0 rounded-full px-4 py-2.5 text-sm font-medium ring-1", active(h) ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-black/5")}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
