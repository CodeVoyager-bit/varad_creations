import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { setDisabledA } from "@/app/actions/admin";
import { ActionButton } from "@/components/admin-ui";
import { StatusBadges } from "@/components/order-bits";
import { Card, fmtDate } from "@/components/ui";
import { C, plain } from "@/lib/db";
import { rupees } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { audit } from "@/server/core";

export const metadata = { title: "Customer" };

export default async function Customer({ params }: PageProps<"/admin/customers/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const u = ObjectId.isValid(id) ? await C.users.findOne({ _id: new ObjectId(id) }) : null;
  if (!u) notFound();
  // viewing personal data is itself recorded
  await audit({ id: admin.id, role: "admin", name: admin.name }, "customer.view", "user", id);
  const [orders, addresses, tickets] = await Promise.all([
    C.orders.find({ userId: id }).sort({ createdAt: -1 }).limit(50).toArray(),
    C.addresses.find({ userId: id }).toArray(),
    C.support.find({ userId: id }).sort({ createdAt: -1 }).toArray(),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/admin/customers" className="text-sm font-semibold text-burgundy-700">
        ← Customers
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">{u.name}</h1>
        <ActionButton size="sm" variant={u.disabled ? "secondary" : "ghost"} action={setDisabledA.bind(null, id, !u.disabled)} confirm={u.disabled ? undefined : "Disable this account? They will be signed out."}>
          {u.disabled ? "Enable account" : "Disable account"}
        </ActionButton>
      </div>
      <Card className="p-4 text-sm">
        <p>
          {u.phoneNumber} · role {u.role} · joined {fmtDate(u.createdAt)}
        </p>
        {addresses.map((a) => (
          <p key={String(a._id)} className="text-ink-700">
            {a.label}: {a.flat}, {a.building}, {a.street}, {a.city} {a.pincode}
          </p>
        ))}
      </Card>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Orders</h2>
        <ul className="divide-y divide-cream-100">
          {plain(orders).map((o) => (
            <li key={o._id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <Link href={`/admin/orders/${o._id}`} className="font-semibold text-burgundy-700">
                #{o.number} · {rupees(o.pricing.totalPaise)} · {fmtDate(o.createdAt)}
              </Link>
              <StatusBadges o={o} />
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Support requests</h2>
        {tickets.map((t) => (
          <p key={t.ticket} className="text-sm">
            <Link href="/admin/support" className="font-semibold">
              {t.ticket}
            </Link>{" "}
            · {t.topic} · {t.status} · {t.message}
          </p>
        ))}
      </Card>
    </div>
  );
}
