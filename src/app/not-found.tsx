import type { Metadata } from "next";
import Link from "next/link";
import { CategoryTiles } from "@/components/catalog";
import { Logo } from "@/components/logo";
import { ButtonLink, Icon } from "@/components/ui";
import { getCatalog, getSettings } from "@/server/storefront";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default async function NotFound() {
  const [s, { categories }] = await Promise.all([getSettings(), getCatalog()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-cream-300 bg-cream-50 px-4 py-3">
        <div className="mx-auto max-w-4xl">
          <Logo name={s.businessName} logoUrl={s.logoUrl} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-10 text-center">
        <svg aria-hidden viewBox="0 0 120 80" className="mx-auto h-24">
          <ellipse cx="60" cy="66" rx="44" ry="8" fill="#e9d8bb" />
          <path d="M20 50c4 18 76 18 80 0z" fill="#9b2238" />
          <path d="M22 50c8-10 18-12 26-8 6-8 18-8 24 0 8-4 20 0 26 8z" fill="#f5a524" />
          <text x="60" y="34" textAnchor="middle" fontSize="22" fontWeight="700" fill="#6f1526" fontFamily="Georgia,serif">
            404
          </text>
        </svg>
        <div>
          <h1 className="font-display text-[1.75rem] font-extrabold tracking-[-0.02em] text-burgundy-700">This page has gone missing</h1>
          <p className="mt-2 text-ink-500">Like the last piece of sev in the packet. Try searching, or pick a category below.</p>
        </div>
        <form action="/search" role="search" className="mx-auto flex h-12 max-w-md items-center gap-2 rounded-xl border border-cream-300 bg-white px-3">
          <Icon name="search" className="size-5 text-ink-500" />
          <input name="q" type="search" placeholder="Search snacks, brands & more" aria-label="Search products" className="h-full w-full bg-transparent outline-none" />
        </form>
        {categories.length > 0 && (
          <div className="mx-auto max-w-2xl text-left">
            <p className="mb-3 text-center font-semibold">Popular categories</p>
            <CategoryTiles categories={categories.slice(0, 8)} />
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href="/products" size="lg">
            Continue shopping
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary" size="lg">
            Contact support
          </ButtonLink>
        </div>
        <p className="text-sm text-ink-500">
          Need help? Call{" "}
          <Link href={`tel:${s.phone.replace(/\s/g, "")}`} className="font-semibold text-burgundy-700">
            {s.phone}
          </Link>
        </p>
      </main>
    </div>
  );
}
