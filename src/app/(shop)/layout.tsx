import { cacheLife } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { AccountMenu, BottomNav, CartBar, CartButton, DesktopNav, LocationPill } from "@/components/shop-chrome";
import { Icon } from "@/components/ui";
import { Skyline } from "@/components/skyline";
import { getCatalog, getSettings, type PublicSettings } from "@/server/storefront";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [s, { products }] = await Promise.all([getSettings(), getCatalog()]);
  const demo = products.some((p) => p.isDemo);
  return (
    <>
      {demo && (
        <p className="no-print border-b border-saffron-100 bg-saffron-50 px-4 py-1.5 text-center text-xs font-medium text-saffron-700">
          Preview store — prices and stock are samples, not live offers.
        </p>
      )}
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-black/[0.06] bg-white/95 pt-[var(--safe-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-2 pt-2.5 md:gap-5 md:py-3">
          <Logo name={s.businessName} logoUrl={s.logoUrl} />
          <div className="hidden min-w-0 md:block md:max-w-56">
            <LocationPill areasLabel={s.service.areasLabel} />
          </div>
          <SearchBox className="hidden flex-1 md:flex" />
          <div className="ml-auto flex items-center gap-1">
            <DesktopNav />
            <Suspense fallback={<span aria-hidden className="block h-9 w-9 rounded-full bg-cream-200 md:w-24 md:rounded-lg" />}>
              <AccountMenu />
            </Suspense>
            <CartButton />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3 md:hidden">
          <SearchBox />
        </div>
      </header>
      <main id="main" className="flex-1 pb-36 md:pb-16">
        {children}
      </main>
      <Footer s={s} />
      {/* usePathname() is request data on dynamic routes, so these stream in */}
      <Suspense>
        <CartBar />
        <BottomNav />
      </Suspense>
    </>
  );
}

function SearchBox({ className = "flex" }: { className?: string }) {
  return (
    <form action="/search" role="search" className={`${className} h-11 items-center gap-2.5 rounded-xl border border-transparent bg-cream-100 px-3.5 transition-colors focus-within:border-burgundy-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-burgundy-500/15`}>
      <Icon name="search" className="size-5 text-ink-500" />
      <input name="q" type="search" placeholder="Search namkeen, brands, pickles…" aria-label="Search products and brands" autoComplete="off" className="h-full w-full bg-transparent text-base outline-none placeholder:text-ink-500 md:text-[15px]" enterKeyHint="search" />
    </form>
  );
}

async function Footer({ s }: { s: PublicSettings }) {
  "use cache";
  cacheLife("days");
  const a = s.address;
  const links = [
    ["/about", "About us"],
    ["/contact", "Contact us"],
    ["/faq", "FAQ"],
    ["/shipping-policy", "Shipping & delivery"],
    ["/cancellation-refund-policy", "Cancellation & refunds"],
    ["/payment-information", "Payments"],
    ["/terms", "Terms & conditions"],
    ["/privacy-policy", "Privacy policy"],
    ["/grievance-redressal", "Grievance redressal"],
  ];
  return (
    <footer className="no-print mt-8 border-t border-black/[0.06] bg-white pb-28 text-ink-700 md:pb-0">
      <div className="mx-auto max-w-6xl px-4 pt-10">
        <p className="max-w-xl font-display text-2xl font-extrabold leading-tight tracking-[-0.02em] text-ink-900 md:text-3xl">
          Indori swad, <span className="text-burgundy-600">ab Pune aur PCMC mein.</span>
        </p>
        <Skyline className="mt-6 h-auto w-full max-w-3xl text-ink-300" />
      </div>
      <div className="mx-auto grid max-w-6xl gap-8 border-t border-black/[0.06] px-4 py-10 md:grid-cols-3">
        <div className="space-y-2 text-sm">
          <p className="font-brand text-xl font-bold text-burgundy-700">{s.businessName}</p>
          <p>{s.tagline}.</p>
          <p>
            {a.line1}
            {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
          </p>
          {s.openingHours && <p>Hours: {s.openingHours}</p>}
          {s.fssaiLicence && <p>FSSAI Reg./Lic. No. {s.fssaiLicence}</p>}
          {s.gstin && <p>GSTIN {s.gstin}</p>}
        </div>
        <nav aria-label="Policies" className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="py-1.5 text-ink-700 hover:text-burgundy-700 hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 text-sm">
          <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="flex min-h-11 items-center gap-2 text-base font-bold text-ink-900">
            <Icon name="phone" className="size-4 text-burgundy-600" /> {s.phone}
          </a>
          <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noopener" className="flex min-h-11 items-center gap-2 hover:text-burgundy-700 hover:underline">
            <Icon name="whatsapp" className="size-4 text-leaf-600" /> Chat on WhatsApp
          </a>
          {s.instagram && (
            <a href={s.instagram} target="_blank" rel="noopener" className="flex min-h-11 items-center gap-2 hover:text-burgundy-700 hover:underline">
              <Icon name="instagram" className="size-4 text-burgundy-600" /> Instagram
            </a>
          )}
          {s.mapsUrl && (
            <a href={s.mapsUrl} target="_blank" rel="noopener" className="flex min-h-11 items-center gap-2 hover:text-burgundy-700 hover:underline">
              <Icon name="pin" className="size-4 text-burgundy-600" /> Find the shop on Google Maps
            </a>
          )}
          <p className="pt-1 text-xs text-ink-500">Delivering across {s.service.areasLabel}. Delivery within {s.delivery.windowHours} hours of order confirmation.</p>
        </div>
      </div>
      <p className="border-t border-black/[0.06] py-4 text-center text-xs text-ink-500">
        © {new Date().getFullYear()} {s.legalName ?? s.businessName}. Brand names belong to their respective owners.
      </p>
    </footer>
  );
}
