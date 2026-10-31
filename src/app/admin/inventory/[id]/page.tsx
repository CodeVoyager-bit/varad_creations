import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { adjustStockA, moveBatchA, receiveStockA } from "@/app/actions/admin";
import { ActionForm, Disclosure } from "@/components/admin-ui";
import { Badge, Button, Card, Field, fmtDate, Input, Select } from "@/components/ui";
import { C } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import type { BatchStatus } from "@/lib/types";

export const metadata = { title: "Stock" };

const MOVES: Record<BatchStatus, [BatchStatus, string][]> = {
  sellable: [
    ["damaged", "Mark damaged"],
    ["expired", "Mark expired"],
  ],
  returned: [
    ["sellable", "Inspected OK — restock"],
    ["damaged", "Damaged"],
    ["expired", "Expired"],
    ["disposed", "Dispose"],
  ],
  damaged: [["disposed", "Dispose"]],
  expired: [["disposed", "Dispose"]],
  disposed: [],
};

export default async function VariantStock({ params }: PageProps<"/admin/inventory/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const v = ObjectId.isValid(id) ? await C.variants.findOne({ _id: new ObjectId(id) }) : null;
  if (!v) notFound();
  const [p, batches, moves] = await Promise.all([
    C.products.findOne({ _id: v.productId }),
    C.batches.find({ variantId: v._id, qty: { $gt: 0 } }).sort({ status: 1, expiryDate: 1 }).toArray(),
    C.movements.find({ variantId: v._id }).sort({ at: -1 }).limit(60).toArray(),
  ]);
  const sellable = batches.filter((b) => b.status === "sellable").reduce((a, b) => a + b.qty, 0);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/admin/inventory" className="text-sm font-semibold text-burgundy-700">
        ← Inventory
      </Link>
      <h1 className="font-display text-2xl font-semibold">
        {p?.name} · {v.label}
      </h1>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          ["Available to sell", v.available],
          ["Held for orders", v.reserved],
          ["Sellable batches", sellable],
        ].map(([l, n]) => (
          <Card key={l} className="p-3">
            <p className="text-2xl font-bold tabular-nums">{n}</p>
            <p className="text-xs text-ink-500">{l}</p>
          </Card>
        ))}
      </div>
      {sellable !== v.available + v.reserved && <p className="text-sm font-semibold text-danger-600">Batch totals ({sellable}) differ from available + held ({v.available + v.reserved}). Do a stock count and adjust.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">Receive stock</h2>
          <ActionForm action={receiveStockA} resetOnSuccess className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="variantId" value={id} />
            <Field label="Quantity (packs)">
              <Input name="qty" type="number" min={1} required />
            </Field>
            <Field label="Batch no. (from pack)">
              <Input name="batchNo" required />
            </Field>
            <Field label="Expiry / best before">
              <Input name="expiryDate" type="date" required={p?.kind === "food"} />
            </Field>
            <Field label="Note">
              <Input name="note" placeholder="Supplier, invoice no." />
            </Field>
            <Button size="sm">Add to stock</Button>
          </ActionForm>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">Correct a count</h2>
          <ActionForm action={adjustStockA} resetOnSuccess className="grid gap-2">
            <input type="hidden" name="variantId" value={id} />
            <Field label="Change (+ found, − missing)">
              <Input name="delta" type="number" required />
            </Field>
            <Field label="Reason (required)">
              <Input name="reason" required placeholder="Monthly stock count" />
            </Field>
            <Button size="sm" variant="secondary">
              Adjust
            </Button>
          </ActionForm>
        </Card>
      </div>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Batches</h2>
        <ul className="divide-y divide-cream-100">
          {batches.map((b) => (
            <li key={String(b._id)} className="space-y-2 py-2 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <Badge tone={b.status === "sellable" ? "good" : b.status === "returned" ? "warn" : "bad"}>{b.status}</Badge>
                <b>{b.batchNo}</b> · {b.qty} pcs · {b.expiryDate ? `exp ${fmtDate(b.expiryDate, false)}` : "no expiry"} · received {fmtDate(b.receivedAt, false)}
                {b.note && <span className="text-ink-500">· {b.note}</span>}
              </p>
              {MOVES[b.status].length > 0 && (
                <Disclosure label="Move units">
                  <ActionForm action={moveBatchA} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="batchId" value={String(b._id)} />
                    <Input name="qty" type="number" min={1} max={b.qty} defaultValue={b.qty} className="w-24" aria-label="Quantity" />
                    <Select name="to" className="w-56" aria-label="Move to">
                      {MOVES[b.status].map(([to, l]) => (
                        <option key={to} value={to}>
                          {l}
                        </option>
                      ))}
                    </Select>
                    <Input name="reason" required placeholder="Reason" className="w-56" />
                    <Button size="sm">Move</Button>
                  </ActionForm>
                </Disclosure>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Movement history</h2>
        <table className="w-full text-sm">
          <tbody>
            {moves.map((m) => (
              <tr key={String(m._id)} className="border-b border-cream-100">
                <td className="py-1 text-ink-500">{fmtDate(m.at)}</td>
                <td className="py-1 font-semibold">{m.type}</td>
                <td className="py-1 text-right tabular-nums">{m.qty}</td>
                <td className="py-1 pl-3 text-ink-500">
                  {m.reason}
                  {m.orderId && (
                    <Link href={`/admin/orders/${m.orderId}`} className="ml-1 underline">
                      order
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
