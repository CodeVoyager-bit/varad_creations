import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { PageMotion } from "@/components/catalog";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default function CartPage() {
  return (
    <PageMotion>
      <div className="mx-auto max-w-6xl px-4 py-4">
        <h1 className="mb-3 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink-900">Your cart</h1>
        <CartView />
      </div>
    </PageMotion>
  );
}
