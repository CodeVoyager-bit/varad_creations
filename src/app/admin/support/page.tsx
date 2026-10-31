import Link from "next/link";
import { ObjectId } from "mongodb";
import { supportAck, supportResolve } from "@/app/actions/admin";
import { ActionButton, ActionForm } from "@/components/admin-ui";
import { Badge, Button, Card, EmptyState, fmtDate, Input } from "@/components/ui";
import { C } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { nowMs } from "@/server/core";

export const metadata = { title: "Support" };

const H48 = 48 * 3600_000;
const D30 = 30 * 86400_000;

export default async function Support() {
  await requireAdmin();
  const [open, recent] = await Promise.all([C.support.find({ status: "open" }).sort({ createdAt: 1 }).toArray(), C.support.find({ status: "resolved" }).sort({ resolvedAt: -1 }).limit(20).toArray()]);
  const users = await C.users.find({ _id: { $in: [...open, ...recent].map((t) => new ObjectId(t.userId)) } }, { projection: { name: 1, phoneNumber: 1 } }).toArray();
  const who = (id: string) => users.find((u) => String(u._id) === id);
  const now = nowMs();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-burgundy-700">Support & grievances</h1>
      <p className="text-sm text-ink-500">E-commerce rules: acknowledge each complaint within 48 hours and resolve it within one month. Account-deletion requests come in here too.</p>
      {open.length ? (
        open.map((t) => {
          const age = now - t.createdAt.getTime();
          return (
            <Card key={t.ticket} className="space-y-2 p-4 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <b>{t.ticket}</b>
                <Badge tone={t.topic === "account_deletion" ? "bad" : "info"}>{t.topic.replace("_", " ")}</Badge>
                {!t.acknowledgedAt && <Badge tone={age > H48 ? "bad" : "warn"}>{age > H48 ? "not acknowledged > 48h" : "not acknowledged"}</Badge>}
                {age > D30 && <Badge tone="bad">open over 30 days</Badge>}
                <span className="text-ink-500">{fmtDate(t.createdAt)}</span>
              </p>
              <p>
                {who(t.userId)?.name} · {who(t.userId)?.phoneNumber}
                {t.orderId && (
                  <>
                    {" · "}
                    <Link className="font-semibold text-burgundy-700 underline" href={`/admin/orders/${t.orderId}`}>
                      #{t.orderNumber}
                    </Link>
                  </>
                )}
              </p>
              <p className="rounded-lg bg-cream-100 p-2">{t.message}</p>
              <div className="flex flex-wrap items-start gap-2">
                {!t.acknowledgedAt && (
                  <ActionButton size="sm" variant="secondary" action={supportAck.bind(null, String(t._id))}>
                    Acknowledge
                  </ActionButton>
                )}
                <ActionForm action={supportResolve.bind(null, String(t._id))} className="flex flex-1 gap-2">
                  <Input name="resolution" placeholder="Resolution shown to the customer" required />
                  <Button size="sm">Resolve</Button>
                </ActionForm>
              </div>
            </Card>
          );
        })
      ) : (
        <EmptyState title="No open requests" />
      )}
      {recent.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">Recently resolved</h2>
          {recent.map((t) => (
            <p key={t.ticket} className="text-sm">
              <b>{t.ticket}</b> · {t.topic} · {t.resolution} <span className="text-ink-500">({fmtDate(t.resolvedAt)})</span>
            </p>
          ))}
        </Card>
      )}
    </div>
  );
}
