import Image from "next/image";
import Link from "next/link";
import { BrandChips, CategoryTiles, JsonLd, ProductRow } from "@/components/catalog";
import { Icon, SectionTitle } from "@/components/ui";
import { rupees } from "@/lib/money";
import { siteUrl } from "@/lib/site";
import { getCatalog, getOffers, getSettings, getStorefront, toCard } from "@/server/storefront";

export default async function HomePage() {
  const [s, { categories, brands, products }, front, offers] = await Promise.all([getSettings(), getCatalog(), getStorefront(), getOffers()]);
  const live = products.filter((p) => p.status === "active");
  const cards = live.map(toCard);
  const banner = front.banners.find((b) => b.active);
  const a = s.address;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Store",
          name: s.businessName,
          url: siteUrl,
          telephone: s.phone.replace(/\s/g, ""),
          address: { "@type": "PostalAddress", streetAddress: a.line1, addressLocality: a.city, addressRegion: a.state, postalCode: a.pincode, addressCountry: "IN" },
          areaServed: [{ "@type": "City", name: "Pune" }, { "@type": "City", name: "Pimpri-Chinchwad" }],
          ...(s.instagram ? { sameAs: [s.instagram] } : {}),
          ...(s.logoUrl ? { logo: s.logoUrl } : {}),
        }}
      />
      {front.announcement && <p className="bg-saffron-100 px-4 py-2 text-center text-sm font-medium text-saffron-700">{front.announcement}</p>}

      <section className="mx-auto max-w-6xl px-4 pt-4">
        {banner && (
          <Link
            href={banner.href ?? "/products"}
            className="relative flex min-h-36 overflow-hidden rounded-2xl bg-gradient-to-br from-burgundy-700 via-burgundy-600 to-burgundy-800 p-5 text-white md:min-h-48 md:p-8"
          >
            <div className="relative z-10 max-w-[62%] space-y-2 md:max-w-md">
              <h1 className="font-display text-2xl font-semibold leading-tight md:text-4xl">{banner.title}</h1>
              {banner.subtitle && <p className="text-sm text-burgundy-100 md:text-base">{banner.subtitle}</p>}
              <p className="inline-flex items-center gap-1.5 rounded-full bg-saffron-400 px-3 py-1 text-xs font-bold text-ink-900">
                <Icon name="truck" className="size-4" /> Within {s.delivery.windowHours} hours of confirmation
              </p>
            </div>
            {banner.image ? (
              <Image src={banner.image} alt="" fill priority sizes="(max-width:768px) 100vw, 1100px" className="object-cover object-right opacity-90" />
            ) : (
              <svg aria-hidden viewBox="0 0 200 160" className="absolute -right-6 bottom-0 h-full opacity-90">
                <ellipse cx="120" cy="130" rx="80" ry="22" fill="#561020" />
                <path d="M48 118c6 30 138 30 144 0z" fill="#e9d8bb" />
                <path d="M52 118c10-22 30-30 46-24 10-14 34-16 46-2 14-6 34 4 44 26z" fill="#f5a524" />
                <g fill="#9a5a03">
                  <circle cx="90" cy="104" r="3" />
                  <circle cx="120" cy="98" r="3" />
                  <circle cx="150" cy="106" r="3" />
                  <circle cx="106" cy="112" r="2.5" />
                  <circle cx="136" cy="112" r="2.5" />
                </g>
                <path d="M160 60c-4 8-4 16 0 22 4-6 4-14 0-22z" fill="#1e8a43" />
              </svg>
            )}
          </Link>
        )}
        <ul className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-ink-700 md:text-sm">
          <li className="rounded-xl bg-white px-2 py-2.5 shadow-sm">
            <Icon name="pin" className="mx-auto mb-1 size-5 text-burgundy-600" />
            Delivering across {s.service.areasLabel}
          </li>
          <li className="rounded-xl bg-white px-2 py-2.5 shadow-sm">
            <Icon name="clock" className="mx-auto mb-1 size-5 text-burgundy-600" />
            Within {s.delivery.windowHours} hrs of confirmation
          </li>
          <li className="rounded-xl bg-white px-2 py-2.5 shadow-sm">
            <Icon name="truck" className="mx-auto mb-1 size-5 text-burgundy-600" />
            Free delivery from {rupees(s.delivery.freeAbovePaise)}*
          </li>
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-5">
        <SectionTitle title="Shop by category" href="/categories" />
        <CategoryTiles categories={categories} row />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-2">
        <SectionTitle title="Shop by brand" href="/brands" />
        <BrandChips brands={brands} />
      </section>

      <ProductRow title="Bestsellers" href="/products" products={cards.filter((p) => p.bestseller)} />

      {offers.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-4">
          <SectionTitle title="Offers" />
          <ul className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
            {offers.map((o) => (
              <li key={o.code} className="w-72 shrink-0 rounded-2xl border border-dashed border-saffron-500 bg-saffron-50 p-4">
                <p className="flex items-center gap-2 font-bold text-saffron-700">
                  <Icon name="tag" className="size-4" /> {o.code}
                </p>
                <p className="mt-1 text-sm text-ink-700">{o.description}</p>
                <p className="mt-1 text-xs text-ink-500">Apply in your cart. One coupon per order.</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {front.collections
        .filter((c) => c.active)
        .map((c) => (
          <ProductRow key={c.id} title={c.title} products={cards.filter((p) => p.tags.includes(c.tag))} />
        ))}

      <ProductRow title="Featured" href="/products" products={cards.filter((p) => p.featured)} />

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-3 rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] md:grid-cols-3">
          <div className="flex gap-3">
            <Icon name="shield" className="size-6 shrink-0 text-leaf-600" />
            <p className="text-sm text-ink-700">
              <b className="block text-ink-900">Sealed, branded packs</b>We sell packaged products from the brands you know — never loose or repacked.
            </p>
          </div>
          <div className="flex gap-3">
            <Icon name="pin" className="size-6 shrink-0 text-leaf-600" />
            <p className="text-sm text-ink-700">
              <b className="block text-ink-900">A real local shop</b>
              {a.line1}, {a.city} {a.pincode}.{" "}
              <a className="font-semibold text-burgundy-700 underline" href={`tel:${s.phone.replace(/\s/g, "")}`}>
                {s.phone}
              </a>
            </p>
          </div>
          <div className="flex gap-3">
            <Icon name="wallet" className="size-6 shrink-0 text-leaf-600" />
            <p className="text-sm text-ink-700">
              <b className="block text-ink-900">Pay by UPI or cash on delivery</b>No hidden fees — just the {rupees(s.delivery.feePaise)} delivery charge on orders under {rupees(s.delivery.freeAbovePaise)}.
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-500">*Free delivery when your order total after coupon discounts is {rupees(s.delivery.freeAbovePaise)} or more.</p>
      </section>
    </>
  );
}
