import Link from "next/link";
import { publishContent } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin-ui";
import { StorefrontEditor } from "@/components/storefront-editor";
import { Card, fmtDate, Notice } from "@/components/ui";
import { C } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import type { StorefrontContent } from "@/lib/types";

export const metadata = { title: "Storefront" };

export default async function Storefront() {
  await requireAdmin();
  const doc = await C.content.findOne({ _id: "storefront" });
  const draft = (doc?.draft as StorefrontContent) ?? { banners: [], collections: [] };
  const changed = JSON.stringify(doc?.draft) !== JSON.stringify(doc?.published);
  const tags = await C.products.distinct("tags", { status: "active" });
  const banner = draft.banners.find((b) => b.active);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="font-display text-2xl font-semibold text-burgundy-700">Storefront</h1>
      <p className="text-sm text-ink-500">
        Bestsellers and Featured come from the product checkboxes; category order from Brands & categories. {doc?.publishedAt && `Last published ${fmtDate(doc.publishedAt)}.`}
      </p>
      <StorefrontEditor initial={draft} />
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Preview of the saved draft</h2>
        {draft.announcement && <p className="rounded-lg bg-saffron-100 px-3 py-2 text-center text-sm text-saffron-700">{draft.announcement}</p>}
        {banner ? (
          <div className="rounded-2xl bg-gradient-to-br from-burgundy-700 to-burgundy-800 p-5 text-white">
            <p className="font-display text-2xl font-semibold">{banner.title}</p>
            <p className="text-sm text-burgundy-100">{banner.subtitle}</p>
            <p className="mt-1 text-xs opacity-70">→ {banner.href ?? "/products"}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-500">No active banner.</p>
        )}
        <ul className="text-sm">
          {draft.collections
            .filter((c) => c.active)
            .map((c) => (
              <li key={c.id}>
                Collection “{c.title}” (tag <code>{c.tag}</code>) {tags.includes(c.tag) ? "" : <span className="text-danger-600">— no active products have this tag</span>}
              </li>
            ))}
        </ul>
        {changed ? (
          <div className="flex items-center gap-3">
            <ActionButton action={publishContent.bind(null, "storefront")} variant="success" confirm="Publish this draft to the live homepage?">
              Publish to homepage
            </ActionButton>
            <Link href="/" target="_blank" className="text-sm underline">
              Open live homepage
            </Link>
          </div>
        ) : (
          <Notice tone="good">The live homepage matches this draft.</Notice>
        )}
      </Card>
    </div>
  );
}
