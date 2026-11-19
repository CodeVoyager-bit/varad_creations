import { fromPrice, inStock } from "@/lib/shop-types";
import { getCatalog } from "@/server/storefront";

/** Compact catalogue for instant search suggestions; rebuilt whenever the catalogue cache is. */
export async function GET() {
  const { products } = await getCatalog();
  const items = products
    .filter((p) => p.status === "active")
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      brand: p.brand.name,
      image: p.image ?? null,
      fromPaise: fromPrice(p),
      inStock: inStock(p),
      keys: `${p.name} ${p.brand.name} ${p.category.name} ${p.tags.join(" ")}`.toLowerCase(),
    }));
  return Response.json(items, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
}
