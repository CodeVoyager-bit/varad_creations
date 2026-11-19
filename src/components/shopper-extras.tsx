"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { buyAgainProductIds, reorderLines } from "@/app/actions/customer";
import { authClient } from "@/lib/auth-client";
import type { ShopProduct } from "@/lib/shop-types";
import { cart, qtyOf } from "./cart-store";
import { ProductGrid, ProductRow } from "./catalog";
import { recent, useRecent, useSaved } from "./device-lists";
import { ButtonLink, cx, EmptyState, Icon } from "./ui";

const byIds = (ids: string[], products: ShopProduct[]) => ids.map((id) => products.find((p) => p.id === id)).filter((p): p is ShopProduct => !!p);
/** false during server render and hydration, so device-only lists don't flash an empty state */
const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

/** Product page: remember it for the "Recently viewed" row. */
export function TrackView({ id }: { id: string }) {
  useEffect(() => recent.push(id), [id]);
  return null;
}

/** Signed-in customers: products from their recent orders, ready to add again. */
export function BuyAgainRow({ products }: { products: ShopProduct[] }) {
  const signedIn = !!authClient.useSession().data?.user;
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    if (signedIn) buyAgainProductIds().then(setIds, () => {});
  }, [signedIn]);
  const list = signedIn ? byIds(ids, products) : [];
  return list.length ? <ProductRow title="Buy again" products={list} /> : null;
}

export function RecentRow({ products }: { products: ShopProduct[] }) {
  const list = byIds(useRecent(), products);
  return list.length >= 2 ? <ProductRow title="Recently viewed" products={list} /> : null;
}

export function SavedView({ products }: { products: ShopProduct[] }) {
  const list = byIds(useSaved(), products);
  if (!useHydrated()) return <div className="h-64" />;
  if (!list.length)
    return <EmptyState title="Nothing saved yet" body="Tap the heart on any product to keep it here for later." action={<ButtonLink href="/products">Browse products</ButtonLink>} />;
  return (
    <>
      <p className="mb-3 text-sm text-ink-500">
        {list.length} saved item{list.length === 1 ? "" : "s"} · kept on this device
      </p>
      <ProductGrid products={list} />
    </>
  );
}

/** Native share sheet where there is one (phones), otherwise WhatsApp. */
export function ShareButton({ title, path, store, className }: { title: string; path: string; store: string; className?: string }) {
  return (
    <button
      type="button"
      aria-label={`Share ${title}`}
      onClick={async () => {
        const url = new URL(path, location.origin).href;
        const text = `${title} at ${store}`;
        if (navigator.share) return navigator.share({ title, text, url }).catch(() => {});
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`, "_blank", "noopener");
      }}
      className={cx("grid size-9 cursor-pointer place-items-center rounded-full bg-white/90 text-ink-500 shadow-[0_2px_8px_-2px_rgb(36_23_15/0.25)] transition-[color,scale] hover:text-burgundy-600 active:scale-90", className)}
    >
      <Icon name="share" className="size-[18px]" />
    </button>
  );
}

/** Puts a past order's items back in the cart at today's prices; anything unavailable is left out. */
export function ReorderButton({ orderId, className }: { orderId: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; cart?: boolean } | null>(null);
  return (
    <div className={className}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await reorderLines(orderId);
            if (!r.ok) return setMsg({ text: r.error });
            if (!r.lines.length) return setMsg({ text: "None of these items are available right now." });
            for (const l of r.lines) cart.setQty(l, Math.max(l.qty, qtyOf(cart.get(), l.variantId)));
            if (!r.unavailable) return router.push("/cart");
            setMsg({ text: `Added ${r.lines.length} item${r.lines.length === 1 ? "" : "s"} to your cart. ${r.unavailable} ${r.unavailable === 1 ? "isn't" : "aren't"} available right now.`, cart: true });
          })
        }
        className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-burgundy-600 px-4 text-sm font-semibold text-white transition-[transform,background-color] hover:bg-burgundy-700 active:scale-[0.98] disabled:opacity-60"
      >
        <Icon name="refresh" className={cx("size-4", pending && "animate-spin")} />
        {pending ? "Adding…" : "Order again"}
      </button>
      {msg && (
        <p role="status" className="mt-2 text-sm text-ink-700">
          {msg.text}{" "}
          {msg.cart && (
            <Link href="/cart" className="font-semibold text-burgundy-700 underline">
              Go to cart
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
