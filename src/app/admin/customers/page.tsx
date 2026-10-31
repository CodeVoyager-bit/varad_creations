import Link from "next/link";
import { fmtDate } from "@/components/ui";
import { C } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { escapeRegex } from "@/server/core";

export const metadata = { title: "Customers" };

export default async function Customers({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin();
  const q = String((await searchParams).q ?? "").trim().slice(0, 40);
  const rx = q ? new RegExp(escapeRegex(q), "i") : null;
  const users = await C.users.find({ role: "customer", ...(rx ? { $or: [{ name: rx }, { phoneNumber: rx }] } : {}) }).sort({ createdAt: -1 }).limit(100).toArray();
  const counts = await C.orders.aggregate<{ _id: string; n: number }>([{ $match: { userId: { $in: users.map((u) => String(u._id)) } } }, { $group: { _id: "$userId", n: { $sum: 1 } } }]).toArray();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold text-burgundy-700">Customers</h1>
        <form>
          <input name="q" defaultValue={q} placeholder="Name or phone" aria-label="Search customers" className="h-10 rounded-xl border border-cream-300 bg-white px-3 text-sm" />
        </form>
      </div>
      <ul className="divide-y divide-cream-100 rounded-2xl bg-white shadow-[var(--shadow-card)]">
        {users.map((u) => (
          <li key={String(u._id)}>
            <Link href={`/admin/customers/${u._id}`} className="flex justify-between p-3 text-sm hover:bg-cream-50">
              <span>
                <b>{u.name}</b> · {u.phoneNumber}
                {u.disabled && <span className="ml-2 text-danger-600">disabled</span>}
              </span>
              <span className="text-ink-500">
                {counts.find((c) => c._id === String(u._id))?.n ?? 0} orders · joined {fmtDate(u.createdAt, false)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
