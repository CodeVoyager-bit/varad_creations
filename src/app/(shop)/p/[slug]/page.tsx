import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BuyBox, Gallery } from "@/components/buy-box";
import { Breadcrumbs, JsonLd, ProductRow } from "@/components/catalog";
import { Badge, Icon } from "@/components/ui";
import { rupees } from "@/lib/money";
import type { ShopProductDetail } from "@/lib/shop-types";
import { siteUrl } from "@/lib/site";
import { getCatalog, getRedirect, getSettings, toCard } from "@/server/storefront";

// fully static (revalidated by tag) so unknown slugs return a real 404
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const { products } = await getCatalog();
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: "_" }];
}

async function load(slug: string) {
  const { products } = await getCatalog();
  const p = products.find((x) => x.slug === slug);
  if (!p) {
    const to = await getRedirect(`/p/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }
  return { p, related: products.filter((x) => x.id !== p.id && x.status === "active" && (x.category.slug === p.category.slug || x.brand.slug === p.brand.slug)).slice(0, 10) };
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { p } = await load((await params).slug);
  const v = p.variants[0];
  const title = p.seo?.title ?? `${p.brand.name} ${p.name}${p.variants.length === 1 ? ` ${v.label}` : ""}`;
  const description =
    p.seo?.description ?? `Buy ${p.brand.name} ${p.name} (${p.variants.map((x) => x.label).join(", ")}) from ${rupees(Math.min(...p.variants.map((x) => x.pricePaise)))}. Delivered across Pune and PCMC.`;
  return {
    title,
    description,
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: { type: "website", title, description, images: p.image ? [{ url: p.image }] : undefined },
    robots: p.status === "discontinued" ? { index: false, follow: true } : undefined,
  };
}

function Info({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null;
  return (
    <div className="py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-ink-900">{value}</dd>
    </div>
  );
}

function VegMark({ d }: { d?: string }) {
  if (d !== "veg" && d !== "nonveg") return null;
  const veg = d === "veg";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      <span aria-hidden className={`grid size-4 place-items-center border-2 ${veg ? "border-leaf-600" : "border-[#7b3f00]"}`}>
        <span className={`size-2 rounded-full ${veg ? "bg-leaf-600" : "bg-[#7b3f00]"}`} />
      </span>
      {veg ? "Vegetarian (as declared on pack)" : "Non-vegetarian (as declared on pack)"}
    </span>
  );
}

function Details({ p }: { p: ShopProductDetail }) {
  const f = p.food ?? {};
  const n = p.nonFood ?? {};
  const food = p.kind === "food";
  const anyLabel = food ? Object.values(f).some((x) => x && String(x).trim()) : Object.values(n).some((x) => x && String(x).trim());
  return (
    <section className="space-y-3">
      {p.description && <p className="whitespace-pre-line text-sm leading-6 text-ink-700">{p.description}</p>}
      {food && <VegMark d={f.dietary} />}
      <details open className="group rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
          {food ? "Label information" : "Product details"}
          <Icon name="down" className="size-4 transition group-open:rotate-180" />
        </summary>
        {anyLabel ? (
          <dl className="mt-2 divide-y divide-cream-200">
            {food ? (
              <>
                <Info label="Ingredients" value={f.ingredients} />
                <Info label="Allergen information" value={f.allergens} />
                <Info label="Additives" value={f.additives} />
                <Info label="Nutrition information" value={f.nutrition} />
                <Info label="Storage" value={f.storage} />
                <Info label="Shelf life" value={f.shelfLife} />
                <Info label="Instructions for use" value={f.instructions} />
                <Info label="Manufacturer / packer" value={f.manufacturer} />
                <Info label="Marketed by (brand owner)" value={f.marketer} />
                <Info label="Brand owner's FSSAI licence no." value={f.fssaiLicence} />
                <Info label="Importer" value={f.importer} />
                <Info label="Consumer care" value={f.consumerCare} />
                <Info label="Country of origin" value={f.countryOfOrigin} />
              </>
            ) : (
              <>
                <Info label="Material" value={n.material} />
                <Info label="Capacity" value={n.capacity} />
                <Info label="Dimensions" value={n.dimensions} />
                <Info label="Care instructions" value={n.care} />
                <Info label="Warranty" value={n.warranty} />
                <Info label="Manufacturer" value={n.manufacturer} />
                <Info label="Importer" value={n.importer} />
                <Info label="Consumer care" value={n.consumerCare} />
                <Info label="Country of origin" value={n.countryOfOrigin} />
              </>
            )}
            {p.attributes.map((a) => (
              <Info key={a.label} label={a.label} value={a.value} />
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-ink-500">
            Label details for this product are being added. Please refer to the label photos or{" "}
            <Link href="/contact" className="font-semibold text-burgundy-700 underline">
              contact us
            </Link>{" "}
            before ordering if you have dietary or allergy concerns.
          </p>
        )}
        {food && <p className="mt-3 text-xs text-ink-500">Batch number, manufacturing and expiry dates are printed on the pack you receive. Information shown here is copied from the pack label.</p>}
      </details>
    </section>
  );
}

export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const [{ p, related }, s] = await Promise.all([load((await params).slug), getSettings()]);
  const url = `${siteUrl}/p/${p.slug}`;
  const discontinued = p.status === "discontinued";
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: `${p.brand.name} ${p.name}`,
            brand: { "@type": "Brand", name: p.brand.name },
            category: p.category.name,
            ...(p.images.length ? { image: p.images } : {}),
            ...(p.description ? { description: p.description } : {}),
            offers: p.variants.map((v) => ({
              "@type": "Offer",
              name: v.label,
              url,
              price: (v.pricePaise / 100).toFixed(2),
              priceCurrency: "INR",
              itemCondition: "https://schema.org/NewCondition",
              availability: discontinued ? "https://schema.org/Discontinued" : v.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              seller: { "@type": "Organization", name: s.businessName },
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
              { "@type": "ListItem", position: 2, name: p.category.name, item: `${siteUrl}/c/${p.category.slug}` },
              { "@type": "ListItem", position: 3, name: p.name, item: url },
            ],
          },
        ]}
      />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: p.category.name, href: `/c/${p.category.slug}` }, { name: p.name }]} />
      <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-10">
        <Gallery images={p.images} labels={p.labelImages} name={p.name} brand={p.brand.name} />
        <div className="space-y-5">
          <div>
            <Link href={`/b/${p.brand.slug}`} className="text-sm font-bold uppercase tracking-wide text-burgundy-600 hover:underline">
              {p.brand.name}
            </Link>
            <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em] md:text-[1.75rem]">{p.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.isDemo && <Badge>Sample product — demonstration price</Badge>}
              {p.bestseller && <Badge tone="warn">Bestseller</Badge>}
            </div>
          </div>
          {discontinued && (
            <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-600">This product is no longer available. Have a look at similar products below.</p>
          )}
          <BuyBox p={toCard(p)} discontinued={discontinued} />
          <ul className="space-y-2 rounded-2xl bg-white p-4 text-sm text-ink-700 shadow-[var(--shadow-card)]">
            <li className="flex gap-2">
              <Icon name="truck" className="size-5 shrink-0 text-burgundy-600" />
              Delivered across {s.service.areasLabel} within {s.delivery.windowHours} hours of order confirmation.
            </li>
            <li className="flex gap-2">
              <Icon name="tag" className="size-5 shrink-0 text-burgundy-600" />
              {rupees(s.delivery.feePaise)} delivery below {rupees(s.delivery.freeAbovePaise)}; free at {rupees(s.delivery.freeAbovePaise)}+ after discounts. No other fees.
            </li>
            <li className="flex gap-2">
              <Icon name="wallet" className="size-5 shrink-0 text-burgundy-600" />
              Pay by UPI or cash on delivery.
            </li>
          </ul>
          <Details p={p} />
        </div>
      </div>
      <div className="-mx-4 mt-6">
        <ProductRow title="You may also like" products={related.map(toCard)} />
      </div>
    </div>
  );
}
