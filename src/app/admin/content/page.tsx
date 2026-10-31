import Link from "next/link";
import { deleteRedirectA, publishContent, savePolicyDraft, saveRedirectA } from "@/app/actions/admin";
import { ActionButton, ActionForm } from "@/components/admin-ui";
import { Badge, Button, Card, Field, fmtDate, Input, Notice, Textarea } from "@/components/ui";
import { C } from "@/lib/db";
import { POLICY_DRAFTS, POLICY_PAGES } from "@/lib/policy-drafts";
import { policyVars, renderPolicy } from "@/lib/policy-render";
import { requireAdmin } from "@/lib/session";
import type { PolicyContent } from "@/lib/types";
import { loadSettings } from "@/server/settings";

export const metadata = { title: "Policies & SEO" };

export default async function Content({ searchParams }: PageProps<"/admin/content">) {
  await requireAdmin();
  const edit = String((await searchParams).edit ?? "");
  const [docs, redirects, settings] = await Promise.all([C.content.find({ _id: { $regex: /^policy:/ } }).toArray(), C.redirects.find({}).sort({ createdAt: -1 }).toArray(), loadSettings()]);
  const doc = (slug: string) => docs.find((d) => d._id === `policy:${slug}`);
  const page = POLICY_PAGES.find((p) => p.slug === edit);
  const draft = page ? ((doc(edit)?.draft as PolicyContent) ?? POLICY_DRAFTS[edit]) : null;
  const vars = policyVars(settings);
  const missing = draft ? [...new Set([...draft.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((k) => !vars[k]))] : [];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900">Policies & SEO</h1>
      <Notice tone="warn">These are starting drafts written for this business. Have them reviewed by a lawyer or CA before launch. Values in {"{{double braces}}"} come from Settings; missing ones show as “to be added” on the live page.</Notice>
      <Card className="p-4">
        <ul className="divide-y divide-cream-100">
          {POLICY_PAGES.map((p) => {
            const d = doc(p.slug);
            const pending = d && JSON.stringify(d.draft) !== JSON.stringify(d.published);
            return (
              <li key={p.slug} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <Link href={`/admin/content?edit=${p.slug}`} className="font-semibold text-burgundy-700 hover:underline">
                    {p.label}
                  </Link>{" "}
                  <span className="text-ink-500">{p.path}</span>
                </span>
                <span className="flex items-center gap-2">
                  {!d?.published && <Badge>using built-in draft</Badge>}
                  {pending && <Badge tone="warn">unpublished changes</Badge>}
                  {d?.publishedAt && <span className="text-xs text-ink-500">published {fmtDate(d.publishedAt)}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {page && draft && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h2 className="mb-2 font-semibold">Edit draft: {page.label}</h2>
            <ActionForm action={savePolicyDraft.bind(null, page.slug)} className="space-y-2">
              <Field label="Title">
                <Input name="title" defaultValue={draft.title} required />
              </Field>
              <Field label="Search description">
                <Input name="seoDescription" defaultValue={draft.seoDescription} maxLength={160} />
              </Field>
              <Field label="Body" hint="## Heading, ### Subheading, - list item, **bold**, [link](/path), {{placeholder}}">
                <Textarea name="body" defaultValue={draft.body} rows={24} className="font-mono text-xs" />
              </Field>
              <Button size="sm">Save draft</Button>
            </ActionForm>
          </Card>
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Preview</h2>
              <ActionButton size="sm" variant="success" action={publishContent.bind(null, `policy:${page.slug}`)} disabled={!doc(page.slug)} confirm="Publish this draft to the live page?">
                Publish
              </ActionButton>
            </div>
            {!doc(page.slug) && <p className="mb-2 text-xs text-ink-500">Save the draft once before publishing.</p>}
            {missing.length > 0 && <Notice tone="warn">Missing in Settings: {missing.join(", ")}</Notice>}
            <div className="prose-vc mt-2 max-h-[70vh] overflow-y-auto" dangerouslySetInnerHTML={{ __html: `<h2>${draft.title.replace(/</g, "&lt;")}</h2>` + renderPolicy(draft.body, vars) }} />
          </Card>
        </div>
      )}

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Redirects</h2>
        <p className="text-xs text-ink-500">Renaming a product, brand or category slug adds a permanent redirect automatically. Add others for changed product/brand/category URLs here.</p>
        <ActionForm action={saveRedirectA} resetOnSuccess className="flex flex-wrap gap-2">
          <Input name="from" placeholder="/p/old-slug" required className="max-w-xs" />
          <Input name="to" placeholder="/p/new-slug" required className="max-w-xs" />
          <Button size="sm">Add redirect</Button>
        </ActionForm>
        <ul className="divide-y divide-cream-100 text-sm">
          {redirects.map((r) => (
            <li key={r.from} className="flex items-center justify-between py-1.5">
              <span className="font-mono text-xs">
                {r.from} → {r.to}
              </span>
              <ActionButton size="sm" variant="ghost" action={deleteRedirectA.bind(null, r.from)}>
                Remove
              </ActionButton>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="space-y-1 p-4 text-sm text-ink-700">
        <h2 className="font-semibold text-ink-900">Search engines</h2>
        <p>
          Sitemap: <code>/sitemap.xml</code> · Robots: <code>/robots.txt</code>. Product, brand and category titles/descriptions are edited on their own pages; the site default is in Settings. Submit the sitemap in Google Search Console after launch (see docs/DEPLOYMENT.md). Indexing and ranking are never guaranteed.
        </p>
      </Card>
    </div>
  );
}
