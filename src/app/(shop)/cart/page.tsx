import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <h1 className="mb-3 font-display text-2xl font-semibold text-burgundy-700">Your cart</h1>
      <CartView />
    </div>
  );
}
