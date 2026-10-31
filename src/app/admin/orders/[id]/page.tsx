import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import {
  acceptOrder,
  adminCancel,
  adminDelivered,
  adminFailed,
  beginPacking,
  clarifyPayment,
  noPayment,
  orderNote,
  orderReady,
  proposeSub,
  refundDone,
  refundStart,
  reschedule,
  verifyPayment,
} from "@/app/actions/admin";
import { ActionButton, ActionForm, Disclosure } from "@/components/admin-ui";
import { addressLines, Bill, ItemList, StatusBadges } from "@/components/order-bits";
import { Button, Card, Field, fmtDate, Input, Notice, Select, Textarea } from "@/components/ui";
import { C, plain } from "@/lib/db";
import { rupees } from "@/lib/money";
import { canMoveOrder, ORDER_LABEL } from "@/lib/order-rules";
import { requireAdmin } from "@/lib/session";
import { FAILURE_REASONS } from "@/server/delivery";
import { lapseIfDue } from "@/server/orders";
import { signFileUrl } from "@/server/storage";

export const metadata = { title: "Order" };

export default async function AdminOrder({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();
  await lapseIfDue(id);
  const doc = await C.orders.findOne({ _id: new ObjectId(id) });
  if (!doc) notFound();
  const o = plain(doc);
  const [events, customer, batch, variants] = await Promise.all([
    C.paymentEvents.find({ orderId: doc._id }).sort({ at: 1 }).toArray(),
    C.users.findOne({ _id: new ObjectId(o.userId) }, { projection: { name: 1, phoneNumber: 1 } }).catch(() => null),
    doc.delivery.batchId ? C.deliveryBatches.findOne({ _id: doc.delivery.batchId }) : null,
    ["confirmed", "packing"].includes(o.status) ? C.variants.find({ active: true }).project<{ _id: ObjectId; label: string; productId: ObjectId; pricePaise: number; available: number }>({ label: 1, productId: 1, pricePaise: 1, available: 1 }).toArray() : [],
  ]);
  const products = variants.length ? await C.products.find({ _id: { $in: variants.map((v) => v.productId) } }, { projection: { name: 1 } }).toArray() : [];
  const proof = o.upi?.proofFileId ? signFileUrl(o.upi.proofFileId) : null;
  const refundable = o.amountReceivedPaise - o.refundedPaise - o.refundPendingPaise;
  const phone = o.address.phone.replace(/\D/g, "");
  const mapUrl = o.address.lat != null ? `https://www.google.com/maps/search/?api=1&query=${o.address.lat},${o.address.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines(o.address).slice(1).join(", "))}`;
  const awaitingVerify = o.paymentMethod === "upi" && ["awaiting_payment", "verification_pending"].includes(o.paymentStatus) && o.status !== "cancelled";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/admin/orders" className="text-sm font-semibold text-burgundy-700">
        ← Orders
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900">Order #{o.number}</h1>
          <p className="text-sm text-ink-500">
            Placed {fmtDate(o.createdAt)} · {o.paymentMethod === "upi" ? "UPI" : "Cash on delivery"}
            {o.expectedBy && ` · deliver by ${fmtDate(o.expectedBy)}`}
          </p>
        </div>
        <StatusBadges o={o} />
      </div>
      {o.exception && <Notice tone="bad" title="Needs attention">{o.exception}</Notice>}
      {o.stock === "released" && o.status === "placed" && <Notice tone="warn">The stock hold for this order expired. Stock will be re-checked when you accept it.</Notice>}
      {o.substitution?.status === "pending" && <Notice tone="info">Substitution sent {fmtDate(o.substitution.proposedAt)} — waiting for the customer.</Notice>}
      {o.substitution?.status === "rejected" && <Notice tone="warn">The customer declined the proposed substitution. Call them, or cancel and refund.</Notice>}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* next steps */}
          <Card className="space-y-3 p-4">
            <h2 className="font-semibold">Next step</h2>
            {awaitingVerify && (
              <div className="space-y-3 rounded-xl border border-saffron-400 bg-saffron-50 p-3">
                <p className="text-sm">
                  {o.paymentStatus === "verification_pending" ? (
                    <>
                      Customer submitted UTR <b className="font-mono">{o.upi?.reference}</b> at {fmtDate(o.upi?.submittedAt)}.
                    </>
                  ) : (
                    <>No payment reference submitted yet{o.paymentDeadline ? ` (window ends ${fmtDate(o.paymentDeadline)})` : ""}.</>
                  )}{" "}
                  Check your bank / UPI app for {rupees(o.pricing.totalPaise)} before confirming.
                </p>
                {proof && (
                  <a href={proof} target="_blank" rel="noopener" className="text-sm font-semibold text-burgundy-700 underline">
                    View customer’s screenshot (link expires in 10 min)
                  </a>
                )}
                <ActionForm action={verifyPayment.bind(null, o._id)} confirm="Confirm you have seen this money in the business account." className="grid gap-2 sm:grid-cols-3">
                  <Field label="Amount received (₹)">
                    <Input name="amount" defaultValue={(o.pricing.totalPaise / 100).toFixed(2)} inputMode="decimal" required />
                  </Field>
                  <Field label="Note (optional)" className="sm:col-span-2">
                    <Input name="note" placeholder="e.g. seen in HDFC statement" />
                  </Field>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" name="accept" defaultChecked className="accent-burgundy-600" /> Also accept the order (starts the 48-hour window)
                  </label>
                  <Button variant="success" className="sm:col-span-3 sm:justify-self-start">
                    Mark payment received
                  </Button>
                </ActionForm>
                {o.paymentStatus === "verification_pending" && (
                  <Disclosure label="Payment not found? Ask the customer">
                    <ActionForm action={clarifyPayment.bind(null, o._id)} className="space-y-2">
                      <Textarea name="message" required defaultValue="We couldn't find this payment. Please check the UTR and amount, or share a screenshot." />
                      <Button size="sm">Send to customer</Button>
                    </ActionForm>
                  </Disclosure>
                )}
              </div>
            )}
            {o.status === "cancelled" && o.paymentMethod === "upi" && ["verification_pending", "void", "awaiting_payment"].includes(o.paymentStatus) && (
              <div className="space-y-2 rounded-xl bg-cream-100 p-3 text-sm">
                <p>If money for this cancelled order reached your account, record it — a refund will be opened.</p>
                <ActionForm action={verifyPayment.bind(null, o._id)} confirm="Record money received for a cancelled order and open a refund?" className="flex flex-wrap items-end gap-2">
                  <Field label="Amount (₹)">
                    <Input name="amount" defaultValue={(o.pricing.totalPaise / 100).toFixed(2)} className="w-32" />
                  </Field>
                  <Button size="sm" variant="secondary">
                    Record late payment
                  </Button>
                </ActionForm>
                {o.paymentStatus === "verification_pending" && (
                  <ActionForm action={noPayment.bind(null, o._id)} className="flex gap-2">
                    <Input name="note" placeholder="Checked: no payment received" />
                    <Button size="sm" variant="ghost">
                      No payment
                    </Button>
                  </ActionForm>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {o.status === "placed" && (o.paymentStatus === "paid" || o.paymentStatus === "cod_due") && (
                <ActionButton action={acceptOrder.bind(null, o._id)} variant="success">
                  Accept order
                </ActionButton>
              )}
              {o.status === "confirmed" && <ActionButton action={beginPacking.bind(null, o._id)}>Start packing</ActionButton>}
              {["confirmed", "packing"].includes(o.status) && (
                <Link href={`/admin/orders/${o._id}/packing`} className="inline-flex h-11 items-center rounded-xl border border-burgundy-600/30 bg-white px-4 font-semibold text-burgundy-700">
                  Packing list
                </Link>
              )}
              {o.status === "packing" && (
                <ActionButton action={orderReady.bind(null, o._id)} confirm="All items packed and checked? Stock will be deducted now (earliest expiry first).">
                  Mark ready for dispatch
                </ActionButton>
              )}
              {["ready_for_dispatch", "rescheduled"].includes(o.status) && !o.delivery.batchId && (
                <Link href="/admin/delivery" className="inline-flex h-11 items-center rounded-xl bg-burgundy-600 px-4 font-semibold text-white">
                  Assign to a delivery batch
                </Link>
              )}
              {o.status !== "placed" && o.status !== "cancelled" && (
                <Link href={`/admin/orders/${o._id}/bill`} className="inline-flex h-11 items-center rounded-xl px-4 font-semibold text-burgundy-700">
                  Bill
                </Link>
              )}
            </div>
            {o.status === "out_for_delivery" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Disclosure label="Mark delivered (on partner's behalf)">
                  <ActionForm action={adminDelivered.bind(null, o._id)} className="space-y-2">
                    {o.paymentMethod === "cod" && o.paymentStatus === "cod_due" && (
                      <>
                        <Select name="method" defaultValue="cash">
                          <option value="cash">Collected in cash</option>
                          <option value="upi">Collected by UPI</option>
                        </Select>
                        <Input name="amount" defaultValue={(o.pricing.totalPaise / 100).toFixed(2)} aria-label="Amount collected" />
                        <Input name="reference" placeholder="UPI ref (if UPI)" />
                      </>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="confirm" required /> The customer received the order
                    </label>
                    <Button size="sm" variant="success">
                      Confirm delivered
                    </Button>
                  </ActionForm>
                </Disclosure>
                <Disclosure label="Delivery unsuccessful">
                  <ActionForm action={adminFailed.bind(null, o._id)} className="space-y-2">
                    <Select name="reason">
                      {FAILURE_REASONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </Select>
                    <Input name="note" placeholder="Note" />
                    <Button size="sm" variant="danger">
                      Record failed attempt
                    </Button>
                  </ActionForm>
                </Disclosure>
              </div>
            )}
            {o.status === "delivery_failed" && (
              <ActionForm action={reschedule.bind(null, o._id)} className="flex flex-wrap items-end gap-2">
                <Field label="Reschedule for">
                  <Input type="date" name="date" required />
                </Field>
                <Input name="note" placeholder="Agreed with customer…" className="max-w-xs" />
                <Button size="sm">Reschedule</Button>
              </ActionForm>
            )}
            {["confirmed", "packing"].includes(o.status) && o.substitution?.status !== "pending" && (
              <Disclosure label="Propose substitution / remove items">
                <ActionForm action={proposeSub.bind(null, o._id)} className="space-y-2 text-sm">
                  <p className="text-ink-500">Change quantities (0 removes) or pick a replacement. The customer must approve before anything changes.</p>
                  {o.items.map((it, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[1fr_90px_1fr]">
                      <span className="self-center">
                        {it.name} ({it.variantLabel})
                      </span>
                      <Input name={`qty_${i}`} type="number" min={0} max={24} defaultValue={it.qty} aria-label={`Quantity for ${it.name}`} />
                      <Select name={`variant_${i}`} defaultValue="" aria-label={`Replacement for ${it.name}`}>
                        <option value="">Keep this product</option>
                        {variants
                          .filter((v) => v.available > 0)
                          .map((v) => (
                            <option key={String(v._id)} value={String(v._id)}>
                              {products.find((p) => p._id.equals(v.productId))?.name} — {v.label} — {rupees(v.pricePaise)} ({v.available} free)
                            </option>
                          ))}
                      </Select>
                    </div>
                  ))}
                  <Input name="note" placeholder="Message to customer (e.g. 500 g out of stock, 2 × 250 g instead)" />
                  <Button size="sm">Send for approval</Button>
                </ActionForm>
              </Disclosure>
            )}
            {canMoveOrder(o.status, "cancelled") && (
              <Disclosure label="Cancel order" variant="ghost">
                <ActionForm action={adminCancel.bind(null, o._id)} confirm="Cancel this order? Stock is released; paid amounts move to refund pending." className="space-y-2">
                  <Input name="reason" required placeholder="Reason (shown to the customer)" />
                  <Button size="sm" variant="danger">
                    Cancel order
                  </Button>
                </ActionForm>
              </Disclosure>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-1 font-semibold">Items</h2>
            <ItemList items={o.items} />
            <div className="mt-2 border-t border-cream-200 pt-2">
              <Bill p={o.pricing} />
            </div>
            {o.customerNote && <p className="mt-3 rounded-xl bg-cream-100 px-3 py-2 text-sm">Customer note: {o.customerNote}</p>}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 font-semibold">Payment ledger</h2>
            {events.length ? (
              <ul className="space-y-1 text-sm">
                {events.map((e) => (
                  <li key={String(e._id)} className="flex justify-between gap-2 border-b border-cream-100 py-1 last:border-0">
                    <span>
                      {e.type.replace(/_/g, " ")}
                      {e.reference ? ` · ${e.reference}` : ""}
                      {e.note ? ` · ${e.note}` : ""}
                      <span className="block text-xs text-ink-500">
                        {fmtDate(e.at)} · {e.byRole} {e.by.slice(-6)}
                      </span>
                    </span>
                    <span className="tabular-nums">{e.amountPaise ? rupees(e.amountPaise) : ""}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">No payment events yet.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {refundable > 0 && ["paid", "collection_recorded", "partially_refunded"].includes(o.paymentStatus) && (
                <Disclosure label="Start a refund">
                  <ActionForm action={refundStart.bind(null, o._id)} className="space-y-2">
                    <Input name="amount" placeholder={`Up to ${(refundable / 100).toFixed(2)}`} required inputMode="decimal" />
                    <Input name="reason" placeholder="Reason (e.g. damaged item)" required />
                    <Button size="sm">Open refund</Button>
                  </ActionForm>
                </Disclosure>
              )}
              {o.paymentStatus === "refund_pending" && (
                <Disclosure label={`Complete refund of ${rupees(o.refundPendingPaise)}`} variant="primary">
                  <ActionForm action={refundDone.bind(null, o._id)} confirm="Only confirm after the money has actually been sent." className="space-y-2">
                    <Input name="reference" placeholder="Refund UTR / reference" required />
                    <Button size="sm" variant="success">
                      Mark refund completed
                    </Button>
                  </ActionForm>
                </Disclosure>
              )}
            </div>
            {o.cod && (
              <p className="mt-3 text-sm">
                COD: {rupees(o.cod.collectedPaise)} by {o.cod.method} recorded {fmtDate(o.cod.recordedAt)} ·{" "}
                {o.cod.reconciledAt ? <span className="text-leaf-700">settled {fmtDate(o.cod.reconciledAt)}</span> : <span className="font-semibold text-saffron-700">not yet settled with shop</span>}
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-1 p-4 text-sm">
            <h2 className="font-semibold">Customer & address</h2>
            {addressLines(o.address).map((l) => (
              <p key={l}>{l}</p>
            ))}
            {o.address.instructions && <p className="text-ink-500">“{o.address.instructions}”</p>}
            <p className="text-xs text-ink-500">Account: {customer ? `${customer.name} (${customer.phoneNumber})` : o.userId}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <a href={`tel:+${phone}`} className="rounded-lg bg-cream-200 px-3 py-1.5 font-semibold">
                Call
              </a>
              <a href={`https://wa.me/${phone}?text=${encodeURIComponent(`Hello from Varad Creation about your order ${o.number}.`)}`} target="_blank" rel="noopener" className="rounded-lg bg-leaf-100 px-3 py-1.5 font-semibold text-leaf-700">
                WhatsApp
              </a>
              <a href={mapUrl} target="_blank" rel="noopener" className="rounded-lg bg-cream-200 px-3 py-1.5 font-semibold">
                Map
              </a>
              <Link href={`/admin/customers/${o.userId}`} className="rounded-lg bg-cream-200 px-3 py-1.5 font-semibold">
                Profile
              </Link>
            </div>
          </Card>
          {batch && (
            <Card className="p-4 text-sm">
              <h2 className="font-semibold">Delivery</h2>
              <p>
                Batch{" "}
                <Link className="font-semibold text-burgundy-700 underline" href={`/admin/delivery/${batch._id}`}>
                  {batch.code}
                </Link>{" "}
                · {batch.partnerName} ({batch.partnerType})
              </p>
              {o.delivery.attempts.map((a, i) => (
                <p key={i} className="text-danger-600">
                  Attempt {fmtDate(a.at)}: {a.reason}
                  {a.note ? ` — ${a.note}` : ""}
                </p>
              ))}
            </Card>
          )}
          <Card className="p-4">
            <h2 className="mb-2 font-semibold">Timeline</h2>
            <ol className="space-y-2 text-sm">
              {[...o.timeline].reverse().map((t, i) => (
                <li key={i} className="border-l-2 border-cream-300 pl-3">
                  <p className="font-medium">{t.event}</p>
                  <p className="text-xs text-ink-500">
                    {fmtDate(t.at)}
                    {t.by ? ` · ${t.by}` : ""}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="space-y-2 p-4">
            <h2 className="font-semibold">Internal notes</h2>
            {o.adminNotes.map((n, i) => (
              <p key={i} className="rounded-lg bg-cream-100 px-2 py-1 text-sm">
                {n.text}
                <span className="block text-xs text-ink-500">
                  {n.by} · {fmtDate(n.at)}
                </span>
              </p>
            ))}
            <ActionForm action={orderNote.bind(null, o._id)} resetOnSuccess className="flex gap-2">
              <Input name="text" placeholder="Add a note" />
              <Button size="sm" variant="secondary">
                Add
              </Button>
            </ActionForm>
          </Card>
          <p className="text-xs text-ink-500">Status: {ORDER_LABEL[o.status]} · stock {o.stock}</p>
        </div>
      </div>
    </div>
  );
}
