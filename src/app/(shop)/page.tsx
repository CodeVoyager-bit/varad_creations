import Image from "next/image";
import Link from "next/link";
import { BrandCards, CategoryTiles, JsonLd, PageMotion, ProductRow, SectionHeader } from "@/components/catalog";
import { LocationPill } from "@/components/shop-chrome";
import { Icon } from "@/components/ui";
import { rupees } from "@/lib/money";
import { siteUrl } from "@/lib/site";
import { getCatalog, getOffers, getSettings, getStorefront, toCard } from "@/server/storefront";

export default async function HomePage() {
  const [s, { categories, brands, products }, front, offers] = await Promise.all([getSettings(), getCatalog(), getStorefront(), getOffers()]);
  const live = products.filter((p) => p.status === "active");
  const cards = live.map(toCard);
  const banner = front.banners.find((b) => b.active);
  const a = s.address;
  const ranked = [...live].sort((x, y) => Number(y.bestseller) - Number(x.bestseller) || Number(y.featured) - Number(x.featured));
  const packsOf = (slug?: string) => ranked.filter((p) => p.image && (!slug || p.category.slug === slug)).map((p) => p.image!);
  // shelves with enough products to fill a row, largest first
  const shelves = categories.filter((c) => (c.productCount ?? 0) >= 4).sort((x, y) => (y.productCount ?? 0) - (x.productCount ?? 0));
  const hero = shelves[0];
  const promos = shelves.slice(1, 3).map((c) => ({
    href: `/c/${c.slug}`,
    title: `${c.name} favourites`,
    sub: c.description ?? `${c.productCount} picks from ${new Set(live.filter((p) => p.category.slug === c.slug).map((p) => p.brand.slug)).size} brands`,
    packs: packsOf(c.slug),
  }));
  // each product sits on exactly one category shelf, so shelves can carry the photo morph
  const shelf = (c: (typeof shelves)[number]) => <ProductRow key={c.id} morph title={c.name} href={`/c/${c.slug}`} products={cards.filter((p) => p.category.slug === c.slug)} />;

  return (
    <PageMotion>
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

      <section aria-label="Highlights" className="mx-auto max-w-6xl pt-3 md:px-4 md:pt-5">
        <ul className="scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 md:px-0 lg:grid lg:grid-cols-[1.45fr_1fr_1fr] lg:overflow-visible">
          <li className="rise w-[88%] shrink-0 snap-start md:w-[60%] lg:w-auto">
            <Promo
              heading
              href={banner?.href ?? (hero ? `/c/${hero.slug}` : "/products")}
              title={banner?.title ?? "Indori namkeen, delivered home"}
              sub={banner?.subtitle ?? `Sealed packs from Indore's favourite makers, delivered across ${s.service.areasLabel}.`}
              cta="Shop now"
              tone="bg-[#ffe6b3]"
              image={banner?.image}
              packs={packsOf(hero?.slug)}
            />
          </li>
          {promos.map((p, i) => (
            <li key={p.href} className="rise w-[88%] shrink-0 snap-start md:w-[45%] lg:w-auto" style={{ "--i": i + 1 } as React.CSSProperties}>
              <Promo {...p} cta="Explore" tone={["bg-[#dcefd6]", "bg-[#f9dde3]"][i]} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Delivery" className="mx-auto max-w-6xl px-4 pt-3">
        <div className="md:hidden">
          <LocationPill areasLabel={s.service.areasLabel} />
        </div>
        <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {[
            { icon: "clock" as const, text: `Delivery within ${s.delivery.windowHours} hours` },
            { icon: "truck" as const, text: `Free delivery over ${rupees(s.delivery.freeAbovePaise)}*` },
            { icon: "wallet" as const, text: "UPI or cash on delivery" },
            { icon: "shield" as const, text: "Sealed, branded packs" },
          ].map((x, i) => (
            <li key={x.text} style={{ "--i": i + 3 } as React.CSSProperties} className="rise flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-medium text-ink-700 ring-1 ring-black/[0.06]">
              <Icon name={x.icon} className="size-4 text-leaf-600" />
              {x.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="reveal mx-auto max-w-6xl px-4 pt-6">
        <SectionHeader title="Shop by category" href="/categories" />
        <CategoryTiles categories={categories} />
      </section>

      <ProductRow title="Bestsellers" href="/products" products={cards.filter((p) => p.bestseller)} />

      {offers.length > 0 && (
        <section className="reveal mx-auto max-w-6xl px-4 py-4">
          <SectionHeader title="Offers for you" />
          <ul className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:px-0">
            {offers.map((o) => (
              <li key={o.code} className="group relative flex w-72 shrink-0 items-stretch rounded-2xl bg-white ring-1 ring-black/[0.06] md:w-auto">
                <span className="grid w-14 shrink-0 place-items-center rounded-l-2xl border-r-2 border-dashed border-cream-300 bg-saffron-50 text-saffron-700">
                  <Icon name="tag" className="size-5 transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110 motion-reduce:transform-none" />
                </span>
                <span aria-hidden className="absolute -top-2 left-[3.05rem] size-4 rounded-full bg-cream-100 ring-1 ring-inset ring-black/[0.06] [clip-path:inset(50%_0_0_0)]" />
                <span aria-hidden className="absolute -bottom-2 left-[3.05rem] size-4 rounded-full bg-cream-100 ring-1 ring-inset ring-black/[0.06] [clip-path:inset(0_0_50%_0)]" />
                <span className="min-w-0 p-3.5">
                  <b className="block font-mono text-[15px] tracking-wider text-ink-900">{o.code}</b>
                  <span className="mt-0.5 block text-sm leading-snug text-ink-700">{o.description}</span>
                  <span className="mt-1 block text-xs text-ink-500">Apply in your cart · one coupon per order</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {shelves.slice(0, 2).map(shelf)}

      <section className="reveal mx-auto max-w-6xl px-4 py-4">
        <SectionHeader title="Shop by brand" href="/brands" />
        <BrandCards brands={brands} />
      </section>

      {front.collections
        .filter((c) => c.active)
        .map((c) => (
          <ProductRow key={c.id} title={c.title} products={cards.filter((p) => p.tags.includes(c.tag))} />
        ))}

      {shelves.slice(2).map(shelf)}

      <ProductRow title="Handpicked for you" href="/products" products={cards.filter((p) => p.featured)} />

      <section className="reveal mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-4 rounded-3xl bg-white p-5 ring-1 ring-black/[0.06] md:grid-cols-3 md:p-6">
          {[
            { icon: "shield" as const, title: "Sealed, branded packs", body: "Packaged products from the brands you know — never loose or repacked." },
            {
              icon: "store" as const,
              title: "A real shop in Hadapsar",
              body: (
                <>
                  {a.line1}, {a.city} {a.pincode} ·{" "}
                  <a className="font-semibold text-burgundy-700 underline" href={`tel:${s.phone.replace(/\s/g, "")}`}>
                    {s.phone}
                  </a>
                </>
              ),
            },
            { icon: "wallet" as const, title: "Honest pricing", body: `No hidden fees — only a ${rupees(s.delivery.feePaise)} delivery charge below ${rupees(s.delivery.freeAbovePaise)}.` },
          ].map((x) => (
            <div key={x.title} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf-50 text-leaf-700">
                <Icon name={x.icon} className="size-5" />
              </span>
              <p className="text-sm text-ink-700">
                <b className="mb-0.5 block text-ink-900">{x.title}</b>
                {x.body}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 px-1 text-xs text-ink-500">*Free delivery when your order total after coupon discounts is {rupees(s.delivery.freeAbovePaise)} or more.</p>
      </section>
    </PageMotion>
  );
}

/** Promo card: real pack shots (white backgrounds multiply into the tint) beside a short headline. */
function Promo({ href, title, sub, cta, tone, packs, image, heading }: { href: string; title: string; sub: string; cta: string; tone: string; packs: string[]; image?: string; heading?: boolean }) {
  const H = heading ? "h1" : "p";
  return (
    <Link href={href} className={`group relative isolate flex h-[12.5rem] overflow-hidden rounded-3xl p-5 md:h-52 ${tone}`}>
      {image && <Image src={image} alt="" fill priority={heading} sizes="(max-width:768px) 90vw, 520px" className="-z-10 object-cover opacity-25" />}
      <span className="relative z-10 flex max-w-[54%] flex-col">
        <H className="font-display text-[1.25rem] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink-900 md:text-[1.625rem]">{title}</H>
        <span className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink-700 md:line-clamp-3">{sub}</span>
        <span className="mt-auto inline-flex h-9 w-fit items-center gap-1 rounded-full bg-ink-900 pl-4 pr-3 text-[13px] font-semibold text-white transition-transform group-active:scale-[0.97] motion-reduce:transform-none">
          {cta} <Icon name="chevron" className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
      </span>
      <span aria-hidden className="absolute -right-10 -top-10 -z-10 size-48 rounded-full bg-white/45 blur-2xl" />
      <span aria-hidden className="absolute inset-y-0 right-0 w-[46%]">
        {packs.slice(0, 2).map((src, i) => (
          <span
            key={src}
            className="float absolute aspect-square mix-blend-multiply transition-[translate,scale] duration-500 ease-out group-hover:-translate-y-1.5 group-hover:scale-105 motion-reduce:transform-none"
            style={i ? { width: "58%", left: "2%", top: "8%", rotate: "-10deg", zIndex: 0, animationDelay: "-2.6s" } : { width: "76%", right: "2%", bottom: "4%", rotate: "5deg", zIndex: 1 }}
          >
            <Image src={src} alt="" fill priority={heading} sizes="200px" className="object-contain" />
          </span>
        ))}
      </span>
    </Link>
  );
}
