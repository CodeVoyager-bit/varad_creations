import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { PageMotion } from "@/components/catalog";
import { inStock } from "@/lib/shop-types";
import { getCatalog, toCard } from "@/server/storefront";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default async function CartPage() {
  const { products } = await getCatalog();
  return (
    <PageMotion>
      <div className="mx-auto max-w-6xl px-4 py-4">
        <h1 className="mb-3 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink-900">Your cart</h1>
        <CartView suggestions={products.filter((p) => p.status === "active" && inStock(p)).map(toCard)} />
      </div>
    </PageMotion>
  );
}
