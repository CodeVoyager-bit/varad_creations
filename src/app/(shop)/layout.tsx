import { cacheLife } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { BottomNav, CartBar, CartButton, DesktopNav, LocationPill } from "@/components/shop-chrome";
import { Icon } from "@/components/ui";
import { getSettings, type PublicSettings } from "@/server/storefront";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-cream-300/70 bg-cream-50/95 pt-[var(--safe-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-2 pt-3 md:gap-6 md:pb-3">
          <Logo name={s.businessName} logoUrl={s.logoUrl} />
          <div className="hidden min-w-0 md:block md:max-w-56">
            <LocationPill areasLabel={s.service.areasLabel} />
          </div>
          <SearchBox className="hidden flex-1 md:flex" />
          <div className="ml-auto flex items-center gap-1">
            <DesktopNav />
            <CartButton />
          </div>
        </div>
        <div className="mx-auto max-w-6xl space-y-2 px-4 pb-3 md:hidden">
          <LocationPill areasLabel={s.service.areasLabel} />
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
    <form action="/search" role="search" className={`${className} h-11 items-center gap-2 rounded-xl border border-cream-300 bg-white px-3 focus-within:border-burgundy-500`}>
      <Icon name="search" className="size-5 text-ink-500" />
      <input name="q" type="search" placeholder="Search snacks, brands & more" aria-label="Search products and brands" className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-ink-300" enterKeyHint="search" />
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
    <footer className="no-print border-t border-cream-300 bg-cream-50 pb-24 md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div className="space-y-2 text-sm text-ink-700">
          <p className="font-display text-lg font-semibold text-burgundy-700">{s.businessName}</p>
          <p>{s.tagline}.</p>
          <p>
            {a.line1}
            {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
          </p>
          {s.openingHours && <p>Hours: {s.openingHours}</p>}
          {s.fssaiLicence && <p>FSSAI Reg./Lic. No. {s.fssaiLicence}</p>}
          {s.gstin && <p>GSTIN {s.gstin}</p>}
        </div>
        <nav aria-label="Policies" className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="text-ink-700 hover:text-burgundy-700 hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 text-sm">
          <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 font-semibold text-ink-900">
            <Icon name="phone" className="size-4" /> {s.phone}
          </a>
          <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-ink-700 hover:underline">
            <Icon name="whatsapp" className="size-4" /> Chat on WhatsApp
          </a>
          {s.instagram && (
            <a href={s.instagram} target="_blank" rel="noopener" className="flex items-center gap-2 text-ink-700 hover:underline">
              <Icon name="instagram" className="size-4" /> Instagram
            </a>
          )}
          {s.mapsUrl && (
            <a href={s.mapsUrl} target="_blank" rel="noopener" className="flex items-center gap-2 text-ink-700 hover:underline">
              <Icon name="pin" className="size-4" /> Find the shop on Google Maps
            </a>
          )}
          <p className="text-xs text-ink-500">Delivering across {s.service.areasLabel}. Delivery within {s.delivery.windowHours} hours of order confirmation.</p>
        </div>
      </div>
      <p className="border-t border-cream-300 py-4 text-center text-xs text-ink-500">
        © {new Date().getFullYear()} {s.legalName ?? s.businessName}. Brand names belong to their respective owners.
      </p>
    </footer>
  );
}
