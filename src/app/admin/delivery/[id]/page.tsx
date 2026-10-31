import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { reissueInviteA, revokeBatchA } from "@/app/actions/admin";
import { ReissueButton } from "@/components/admin-delivery";
import { ActionForm, Disclosure } from "@/components/admin-ui";
import { StatusBadges } from "@/components/order-bits";
import { Badge, Button, Card, fmtDate, Input } from "@/components/ui";
import { C, plain } from "@/lib/db";
import { rupees } from "@/lib/money";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Delivery batch" };

export default async function Batch({ params }: PageProps<"/admin/delivery/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const b = ObjectId.isValid(id) ? await C.deliveryBatches.findOne({ _id: new ObjectId(id) }) : null;
  if (!b) notFound();
  const [orders, invites] = await Promise.all([
    C.orders.find({ _id: { $in: b.orderIds } }).toArray(),
    C.invites.find({ batchId: b._id }).sort({ createdAt: -1 }).toArray(),
  ]);
  const active = ["assigned", "in_progress"].includes(b.status);
  const codDue = orders.filter((o) => o.paymentMethod === "cod" && o.paymentStatus === "cod_due").reduce((a, o) => a + o.pricing.totalPaise, 0);
  const collected = orders.filter((o) => o.cod && o.delivery.batchId?.equals(b._id)).reduce((a, o) => a + o.cod!.collectedPaise, 0);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/admin/delivery" className="text-sm font-semibold text-burgundy-700">
        ← Delivery
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold">Batch {b.code}</h1>
        <Badge tone={b.status === "completed" ? "good" : b.status === "revoked" ? "bad" : "info"}>{b.status.replace("_", " ")}</Badge>
      </div>
      <Card className="space-y-2 p-4 text-sm">
        <p>
          Partner: <b>{b.partnerName}</b> · {b.partnerPhone} · {b.partnerType}
        </p>
        {b.accessExpiresAt && <p>Access until {fmtDate(b.accessExpiresAt)} (or until the batch completes / is revoked)</p>}
        <p>
          COD still to collect: <b>{rupees(codDue)}</b> · recorded collections: <b>{rupees(collected)}</b>
        </p>
        {b.partnerType === "temporary" && (
          <div className="space-y-1">
            <p className="text-xs text-ink-500">
              Links: {invites.map((i) => (i.usedAt ? `used ${fmtDate(i.usedAt)}` : i.revokedAt ? "revoked" : i.expiresAt < new Date() ? "expired" : "unused")).join(" · ") || "none"}
            </p>
            {active && <ReissueButton action={reissueInviteA.bind(null, String(b._id))} />}
          </div>
        )}
        {active && (
          <Disclosure label="Revoke batch access" variant="ghost">
            <ActionForm action={revokeBatchA.bind(null, String(b._id))} confirm="Revoke access? Undelivered ready orders return to the dispatch queue." className="flex gap-2">
              <Input name="reason" placeholder="Reason" />
              <Button size="sm" variant="danger">
                Revoke
              </Button>
            </ActionForm>
          </Disclosure>
        )}
      </Card>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Orders</h2>
        <ul className="divide-y divide-cream-100">
          {plain(orders).map((o) => (
            <li key={o._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <Link href={`/admin/orders/${o._id}`} className="font-semibold text-burgundy-700 hover:underline">
                  #{o.number}
                </Link>{" "}
                · {o.address.name} · {o.address.pincode}
              </span>
              <StatusBadges o={o} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
