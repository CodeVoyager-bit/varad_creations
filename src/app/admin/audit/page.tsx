import Link from "next/link";
import { cx, fmtDate } from "@/components/ui";
import { C } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Audit log" };

const GROUPS: [string, string, RegExp | null][] = [
  ["all", "All", null],
  ["price", "Prices", /^price\./],
  ["stock", "Inventory", /^stock\./],
  ["payment", "Payments & refunds", /^(payment|refund)\./],
  ["order", "Orders", /^order\./],
  ["delivery", "Delivery", /^delivery\./],
  ["settings", "Settings & content", /^(settings|content|policy|storefront|redirect)\./],
  ["users", "Users", /^(user|partner|customer)\./],
];

export default async function Audit({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const { group } = await searchParams;
  const g = GROUPS.find((x) => x[0] === group) ?? GROUPS[0];
  const rows = await C.audit.find(g[2] ? { action: g[2] } : {}).sort({ at: -1 }).limit(300).toArray();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-burgundy-700">Audit log</h1>
      <nav className="flex flex-wrap gap-1">
        {GROUPS.map(([k, l]) => (
          <Link key={k} href={`/admin/audit?group=${k}`} className={cx("rounded-full px-3 py-1.5 text-sm font-semibold", g[0] === k ? "bg-burgundy-600 text-white" : "bg-white")}>
            {l}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[640px] text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={String(r._id)} className="border-b border-cream-100 align-top">
                <td className="whitespace-nowrap p-2 text-ink-500">{fmtDate(r.at)}</td>
                <td className="p-2 font-mono text-xs">{r.action}</td>
                <td className="p-2">
                  {r.entity} {r.entityId && <span className="text-ink-500">{r.entityId.length > 24 ? r.entityId.slice(0, 24) + "…" : r.entityId}</span>}
                  {r.summary && <span className="block text-ink-700">{r.summary}</span>}
                </td>
                <td className="p-2 text-xs text-ink-500">
                  {r.actorRole} {r.actorId.slice(-6)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
