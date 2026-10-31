import Link from "next/link";
import { createBatchA, createPartnerA, setDisabledA } from "@/app/actions/admin";
import { BatchCreator } from "@/components/admin-delivery";
import { ActionButton, ActionForm } from "@/components/admin-ui";
import { Badge, Button, Card, fmtDate, Input } from "@/components/ui";
import { C } from "@/lib/db";
import { rupees } from "@/lib/money";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Delivery" };

export default async function Delivery() {
  await requireAdmin();
  const [ready, batches, partners, failed] = await Promise.all([
    C.orders.find({ status: { $in: ["ready_for_dispatch", "rescheduled"] }, "delivery.batchId": null }).sort({ "address.pincode": 1 }).toArray(),
    C.deliveryBatches.find({}).sort({ createdAt: -1 }).limit(30).toArray(),
    C.users.find({ role: "delivery", partnerType: "permanent" }).sort({ name: 1 }).toArray(),
    C.orders.find({ status: "delivery_failed" }).toArray(),
  ]);
  const counts = await C.orders
    .aggregate<{ _id: string; total: number; done: number }>([
      { $match: { "delivery.batchId": { $in: batches.map((b) => b._id) } } },
      { $group: { _id: { $toString: "$delivery.batchId" }, total: { $sum: 1 }, done: { $sum: { $cond: [{ $in: ["$status", ["delivered", "delivery_failed"]] }, 1, 0] } } } },
    ])
    .toArray();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-burgundy-700">Delivery</h1>
      {failed.length > 0 && (
        <Card className="border-2 border-danger-600/30 p-4">
          <h2 className="mb-1 font-semibold text-danger-600">Unsuccessful deliveries to resolve ({failed.length})</h2>
          {failed.map((o) => (
            <Link key={String(o._id)} href={`/admin/orders/${o._id}`} className="block text-sm text-burgundy-700 underline">
              #{o.number} · {o.address.name} · {o.delivery.attempts.at(-1)?.reason}
            </Link>
          ))}
        </Card>
      )}
      <Card className="p-4">
        <h2 className="mb-3 font-semibold">New delivery batch</h2>
        <BatchCreator
          action={createBatchA}
          orders={ready.map((o) => ({ id: String(o._id), label: `#${o.number} · ${o.address.pincode} ${o.address.street} · ${o.paymentMethod === "cod" && o.paymentStatus === "cod_due" ? `COD ${rupees(o.pricing.totalPaise)}` : "Prepaid"}${o.status === "rescheduled" ? " · rescheduled" : ""}` }))}
          partners={partners.filter((p) => !p.disabled).map((p) => ({ id: String(p._id), name: p.name }))}
        />
      </Card>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Batches</h2>
        <ul className="divide-y divide-cream-100">
          {batches.map((b) => {
            const c = counts.find((x) => x._id === String(b._id));
            return (
              <li key={String(b._id)} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <Link href={`/admin/delivery/${b._id}`} className="font-semibold text-burgundy-700 hover:underline">
                    {b.code}
                  </Link>{" "}
                  · {b.partnerName} {b.partnerType === "temporary" && <Badge tone="warn">temporary</Badge>}
                  <span className="block text-xs text-ink-500">
                    {fmtDate(b.createdAt)} · {c?.done ?? 0}/{c?.total ?? b.orderIds.length} resolved
                  </span>
                </span>
                <Badge tone={b.status === "completed" ? "good" : b.status === "revoked" ? "bad" : "info"}>{b.status.replace("_", " ")}</Badge>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Permanent delivery partners</h2>
        <ul className="divide-y divide-cream-100">
          {partners.map((p) => (
            <li key={String(p._id)} className="flex items-center justify-between py-2 text-sm">
              <span>
                {p.name} · {p.phoneNumber} {p.disabled && <Badge tone="bad">disabled</Badge>}
              </span>
              <ActionButton size="sm" variant="ghost" action={setDisabledA.bind(null, String(p._id), !p.disabled)}>
                {p.disabled ? "Enable" : "Disable"}
              </ActionButton>
            </li>
          ))}
        </ul>
        <ActionForm action={createPartnerA} resetOnSuccess className="flex flex-wrap items-end gap-2">
          <Input name="name" placeholder="Name" required className="max-w-48" />
          <Input name="phone" placeholder="Mobile (10 digits)" inputMode="numeric" maxLength={10} required className="max-w-48" />
          <Button size="sm">Add partner</Button>
        </ActionForm>
      </Card>
    </div>
  );
}
