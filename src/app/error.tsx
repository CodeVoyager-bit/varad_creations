"use client";
import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-ink-900">Something went wrong</h1>
      <p className="text-ink-500">
        This page couldn’t load — often a network hiccup. If you were placing an order or submitting a payment, check <Link className="font-semibold underline" href="/orders">My orders</Link> before trying again so nothing is duplicated.
      </p>
      <div className="flex justify-center gap-3">
        <button onClick={reset} className="h-11 rounded-xl bg-burgundy-600 px-5 font-semibold text-white">
          Try again
        </button>
        <Link href="/" className="inline-flex h-11 items-center rounded-xl border border-burgundy-600/30 px-5 font-semibold text-burgundy-700">
          Home
        </Link>
      </div>
    </main>
  );
}
