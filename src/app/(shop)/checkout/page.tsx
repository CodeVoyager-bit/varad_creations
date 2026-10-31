import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutView } from "@/components/checkout-view";
import { PageLoading } from "@/components/ui";
import { C, plain } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { loadSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <h1 className="mb-3 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink-900">Checkout</h1>
      <Suspense fallback={<PageLoading />}>
        <Checkout />
      </Suspense>
    </div>
  );
}

async function Checkout() {
  const user = await requireUser("/checkout");
  const [addresses, s] = await Promise.all([C.addresses.find({ userId: user.id }).sort({ isDefault: -1, createdAt: -1 }).toArray(), loadSettings()]);
  return (
    <CheckoutView
      addresses={addresses.map(({ _id, userId: _u, createdAt: _c, ...a }) => ({ ...plain(a), id: _id.toHexString() }))}
      user={{ name: user.name, phone: user.phoneNumber ?? undefined }}
      windowHours={s.delivery.windowHours}
      upiMinutes={s.delivery.upiPaymentMinutes}
      upiReady={!!(s.upi.vpa && s.upi.payeeName)}
    />
  );
}
