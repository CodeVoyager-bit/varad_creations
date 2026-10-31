"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { checkPincode, locate } from "@/app/actions/public";
import { rupees } from "@/lib/money";
import { cart, countOf, estimateOf, useCart } from "./cart-store";
import { cx, Icon, Input } from "./ui";

export function LocationPill({ areasLabel }: { areasLabel: string }) {
  const state = useCart();
  const ref = useRef<HTMLDialogElement>(null);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const check = (p: string, area?: string) =>
    start(async () => {
      const r = await checkPincode(p);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) cart.setLocation(p, area);
    });

  const useLocation = () => {
    if (!("geolocation" in navigator)) return setMsg({ ok: false, text: "Location isn't available on this device. Enter your pincode instead." });
    setMsg({ ok: true, text: "Finding your location…" });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        start(async () => {
          const r = await locate(pos.coords.latitude, pos.coords.longitude);
          if ("error" in r) return setMsg({ ok: false, text: r.error! });
          setPin(r.suggestion.pincode);
          setMsg({ ok: r.serviceable, text: r.serviceable ? `We deliver to ${r.suggestion.locality || r.suggestion.city} (${r.suggestion.pincode}).` : r.message! });
          if (r.serviceable) cart.setLocation(r.suggestion.pincode, r.suggestion.locality || r.suggestion.city);
        }),
      () => setMsg({ ok: false, text: "Location permission was denied. No problem — enter your pincode." }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  return (
    <>
      <button onClick={() => ref.current?.showModal()} className="inline-flex max-w-full items-center gap-1.5 text-sm text-ink-700" aria-haspopup="dialog">
        <Icon name="pin" className="size-4 shrink-0 text-burgundy-600" />
        <span className="truncate">
          Deliver to <b className="font-semibold text-ink-900">{state.pincode ? `${state.area ?? ""} ${state.pincode}`.trim() : areasLabel}</b>
        </span>
        <Icon name="down" className="size-4 shrink-0" />
      </button>
      <dialog ref={ref} className="sheet" aria-label="Check delivery location" onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">Where should we deliver?</h2>
              <p className="text-sm text-ink-500">We deliver across {areasLabel}, within 48 hours of order confirmation.</p>
            </div>
            <button onClick={() => ref.current?.close()} className="grid size-9 place-items-center rounded-full bg-cream-200" aria-label="Close">
              <Icon name="close" className="size-4" />
            </button>
          </div>
          <button onClick={useLocation} disabled={pending} className="flex h-12 w-full items-center gap-3 rounded-xl border border-burgundy-600/30 bg-white px-4 font-semibold text-burgundy-700">
            <Icon name="nav" className="size-5" /> Use my location
          </button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              check(pin);
            }}
          >
            <Input inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="Enter 6-digit pincode" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} aria-label="Pincode" />
            <button disabled={pending || pin.length !== 6} className="h-11 shrink-0 rounded-xl bg-burgundy-600 px-5 font-semibold text-white disabled:opacity-50">
              Check
            </button>
          </form>
          {msg && (
            <p role="status" className={cx("rounded-xl px-3 py-2 text-sm", msg.ok ? "bg-leaf-50 text-leaf-700" : "bg-danger-50 text-danger-600")}>
              {msg.text}
            </p>
          )}
          <p className="text-xs text-ink-500">Your location is used only to check delivery and fill your address. You confirm the full address at checkout.</p>
        </div>
      </dialog>
    </>
  );
}

export function CartButton() {
  const s = useCart();
  const n = countOf(s);
  return (
    <Link href="/cart" className="relative grid size-11 place-items-center rounded-full text-ink-900 hover:bg-cream-200" aria-label={`Cart, ${n} item${n === 1 ? "" : "s"}`}>
      <Icon name="cart" className="size-6" />
      {n > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-burgundy-600 px-1 text-[11px] font-bold text-white">{n}</span>}
    </Link>
  );
}

const NAV = [
  { href: "/", label: "Home", icon: "home" as const },
  { href: "/categories", label: "Categories", icon: "grid" as const },
  { href: "/orders", label: "Orders", icon: "box" as const },
  { href: "/account", label: "Account", icon: "user" as const },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-cream-300 bg-white/95 pb-[var(--safe-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-4">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <li key={n.href}>
              <Link href={n.href} aria-current={active ? "page" : undefined} className={cx("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-burgundy-600" : "text-ink-500")}>
                <Icon name={n.icon} className="size-[22px]" />
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DesktopNav() {
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
      {NAV.slice(1).map((n) => (
        <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-200">
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

const HIDE_BAR = ["/cart", "/checkout", "/login", "/register", "/forgot-password"];

/** Persistent cart access that sits above the bottom nav instead of covering it. */
export function CartBar() {
  const s = useCart();
  const path = usePathname();
  const n = countOf(s);
  if (!n || HIDE_BAR.some((p) => path.startsWith(p)) || path.startsWith("/orders/")) return null;
  return (
    <div className="no-print fixed inset-x-0 bottom-[calc(3.5rem+var(--safe-bottom))] z-20 px-3 pb-2 md:bottom-4 md:left-auto md:right-4 md:w-96">
      <Link href="/cart" className="flex h-14 items-center justify-between rounded-2xl bg-burgundy-600 px-4 text-white shadow-lg shadow-burgundy-800/30">
        <span className="flex items-center gap-3 font-semibold">
          <Icon name="cart" className="size-5" />
          {n} item{n === 1 ? "" : "s"} · {rupees(estimateOf(s))}
        </span>
        <span className="flex items-center gap-1 font-semibold">
          View cart <Icon name="chevron" className="size-4" />
        </span>
      </Link>
    </div>
  );
}
