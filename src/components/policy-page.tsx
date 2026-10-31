import type { Metadata } from "next";
import { Breadcrumbs } from "./catalog";
import { POLICY_DRAFTS, POLICY_PAGES } from "@/lib/policy-drafts";
import { policyVars, renderPolicy } from "@/lib/policy-render";
import { getPolicy, getSettings } from "@/server/storefront";

async function load(slug: string) {
  return (await getPolicy(slug)) ?? POLICY_DRAFTS[slug];
}

export async function policyMetadata(slug: string): Promise<Metadata> {
  const p = await load(slug);
  const path = POLICY_PAGES.find((x) => x.slug === slug)!.path;
  return { title: p.title, description: p.seoDescription, alternates: { canonical: path } };
}

export async function PolicyPage({ slug }: { slug: string }) {
  const [p, s] = await Promise.all([load(slug), getSettings()]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: p.title }]} />
      <article className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] md:p-8">
        <h1 className="font-display text-3xl font-semibold text-burgundy-700">{p.title}</h1>
        <div className="prose-vc mt-4" dangerouslySetInnerHTML={{ __html: renderPolicy(p.body, policyVars(s as never)) }} />
      </article>
    </div>
  );
}
