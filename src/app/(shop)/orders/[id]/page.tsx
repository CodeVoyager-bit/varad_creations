import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ObjectId } from "mongodb";
import { addressLines, Bill, ItemList, StatusBadges, Tracker } from "@/components/order-bits";
import { CancelOrder, CopyText, Countdown, PaymentForm, SubstitutionDecision, SupportForm } from "@/components/order-customer";
import { Badge, ButtonLink, Card, fmtDate, Notice, PageLoading } from "@/components/ui";
import { C, plain } from "@/lib/db";
import { rupees } from "@/lib/money";
import { CUSTOMER_CANCELLABLE } from "@/lib/order-rules";
import { requireUser } from "@/lib/session";
import { lapseIfDue } from "@/server/orders";
import { loadSettings } from "@/server/settings";
import { upiLink, upiQrSvg } from "@/server/upi";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

export default function OrderPage(props: PageProps<"/orders/[id]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <Suspense fallback={<PageLoading />}>
        <OrderDetail {...props} />
      </Suspense>
    </div>
  );
}

async function OrderDetail({ params, searchParams }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const placed = (await searchParams).placed === "1";
  const user = await requireUser(`/orders/${id}`);
  if (!ObjectId.isValid(id)) notFound();
  await lapseIfDue(id); // request-time expiry check, independent of the cron
  const doc = await C.orders.findOne({ _id: new ObjectId(id), userId: user.id });
  if (!doc) notFound();
  const o = plain(doc);
  const s = await loadSettings();
  const tickets = await C.support.find({ userId: user.id, orderId: doc._id }).sort({ createdAt: -1 }).toArray();

  const upiReady = !!(s.upi.vpa && s.upi.payeeName);
  const needsPayment = o.paymentMethod === "upi" && o.paymentStatus === "awaiting_payment" && o.status !== "cancelled";
  const link = needsPayment && upiReady ? upiLink({ vpa: s.upi.vpa!, payee: s.upi.payeeName!, amountPaise: o.pricing.totalPaise, orderNumber: o.number }) : null;
  const qr = link ? await upiQrSvg(link) : null;

  return (
    <div className="space-y-4">
      <Link href="/orders" className="text-sm font-semibold text-burgundy-700">
        ← All orders
      </Link>
      {placed && (
        <Notice tone={o.paymentMethod === "upi" ? "warn" : "good"} title={o.paymentMethod === "upi" ? "Order placed — payment pending" : "Order placed"}>
          {o.paymentMethod === "upi"
            ? "Complete the UPI payment below and submit your transaction ID. Your order is confirmed after we verify the payment."
            : "The shop will confirm your order shortly. Pay on delivery."}
        </Notice>
      )}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold">Order #{o.number}</h1>
            <p className="text-sm text-ink-500">Placed {fmtDate(o.createdAt)}</p>
          </div>
          <StatusBadges o={o} />
        </div>
        <p className="mt-3 rounded-xl bg-cream-100 px-3 py-2 text-sm">
          {o.expectedBy && !["delivered", "cancelled"].includes(o.status) ? (
            <>
              Expected by <b>{fmtDate(o.expectedBy)}</b> — within {s.delivery.windowHours} hours of confirmation ({fmtDate(o.confirmedAt)}).
            </>
          ) : o.status === "delivered" ? (
            <>Delivered {fmtDate(o.delivery.deliveredAt)}.</>
          ) : o.status === "cancelled" ? (
            <>This order was cancelled.</>
          ) : (
            <>Delivery within {s.delivery.windowHours} hours of confirmation. The window starts when the shop confirms your order{o.paymentMethod === "upi" ? " after verifying payment" : ""}.</>
          )}
        </p>
        {o.exception && o.status !== "cancelled" && <Notice tone="warn" className="mt-3">The shop is reviewing something on this order and will contact you shortly.</Notice>}
      </Card>

      {needsPayment && (
        <Card className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Pay {rupees(o.pricing.totalPaise)} by UPI</h2>
            {o.paymentDeadline && <Countdown until={o.paymentDeadline} />}
          </div>
          {o.upi?.clarification && <Notice tone="warn" title="Message from the shop">{o.upi.clarification}</Notice>}
          {upiReady ? (
            <>
              <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
                <div className="mx-auto w-44 rounded-xl border border-cream-300 bg-white p-2" aria-label="UPI QR code" role="img" dangerouslySetInnerHTML={{ __html: qr! }} />
                <div className="space-y-2 text-sm">
                  <p>
                    Payee: <b>{s.upi.payeeName}</b>
                  </p>
                  <p className="flex items-center gap-2">
                    UPI ID: <b className="break-all">{s.upi.vpa}</b> <CopyText text={s.upi.vpa!} label="UPI ID" />
                  </p>
                  <p>
                    Amount: <b>{rupees(o.pricing.totalPaise)}</b> · Note: Order {o.number}
                  </p>
                  <a href={link!} className="inline-flex h-11 items-center rounded-xl bg-burgundy-600 px-4 font-semibold text-white sm:hidden">
                    Pay with a UPI app
                  </a>
                  <p className="text-xs text-ink-500">On a computer, scan the QR with any UPI app. Check the payee name before paying.</p>
                </div>
              </div>
              <PaymentForm orderId={o._id} existingRef={o.upi?.reference} />
            </>
          ) : (
            <Notice tone="bad" title="UPI payment isn't available right now">
              Please call {s.phone} — the shop will help you complete this order.
            </Notice>
          )}
        </Card>
      )}

      {o.paymentMethod === "upi" && o.paymentStatus === "verification_pending" && (
        <Notice tone="info" title="Payment verification pending">
          You submitted UPI reference <b>{o.upi?.reference}</b>. We’ll confirm your order as soon as we see the payment in our account.
        </Notice>
      )}
      {o.paymentMethod === "cod" && o.paymentStatus === "cod_due" && o.status !== "cancelled" && (
        <Notice tone="info">Pay {rupees(o.pricing.totalPaise)} on delivery, in cash or by UPI to our delivery partner.</Notice>
      )}
      {(o.refundPendingPaise > 0 || o.refundedPaise > 0) && (
        <Notice tone="info" title="Refund">
          {o.refundPendingPaise > 0 && <>A refund of {rupees(o.refundPendingPaise)} is being processed{s.policy.refundProcessingDays ? ` (usually within ${s.policy.refundProcessingDays} days)` : ""}. </>}
          {o.refundedPaise > 0 && <>{rupees(o.refundedPaise)} has been refunded.</>}
        </Notice>
      )}
      {o.status === "cancelled" && o.cancelledBy === "system" && o.paymentMethod === "upi" && (
        <Notice tone="warn">If you paid for this order after the payment window ended, raise a payment request below with your UPI transaction ID — we’ll verify it and refund you.</Notice>
      )}

      {o.substitution?.status === "pending" && (
        <Card className="space-y-3 border-2 border-saffron-400 p-4">
          <h2 className="font-semibold">The shop suggests a change to your order</h2>
          {o.substitution.note && <p className="text-sm text-ink-700">{o.substitution.note}</p>}
          <ItemList items={o.substitution.items} />
          <Bill p={o.substitution.pricing} />
          {o.paymentMethod === "upi" && o.amountReceivedPaise > o.substitution.pricing.totalPaise && (
            <p className="text-sm text-leaf-700">If you approve, {rupees(o.amountReceivedPaise - o.refundedPaise - o.refundPendingPaise - o.substitution.pricing.totalPaise)} will be refunded to you.</p>
          )}
          <SubstitutionDecision orderId={o._id} />
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">Order status</h2>
        <Tracker o={o} />
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 font-semibold">Items</h2>
        <ItemList items={o.items} />
        <div className="mt-2 border-t border-cream-200 pt-3">
          <Bill p={o.pricing} />
          <p className="mt-1 text-xs text-ink-500">Payment: {o.paymentMethod === "upi" ? "UPI" : "Cash on delivery"}</p>
        </div>
      </Card>

      <Card className="p-4 text-sm">
        <h2 className="mb-1 font-semibold">Delivery address</h2>
        {addressLines(o.address).map((l) => (
          <p key={l} className="text-ink-700">
            {l}
          </p>
        ))}
        {o.address.instructions && <p className="mt-1 text-ink-500">Note: {o.address.instructions}</p>}
      </Card>

      <div className="flex flex-wrap gap-2">
        {CUSTOMER_CANCELLABLE.includes(o.status) && <CancelOrder orderId={o._id} />}
        {o.status !== "placed" && o.status !== "cancelled" && (
          <ButtonLink variant="secondary" href={`/orders/${o._id}/bill`}>
            View bill
          </ButtonLink>
        )}
      </div>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Need help with this order?</h2>
        {tickets.map((t) => (
          <div key={t.ticket} className="rounded-xl bg-cream-100 px-3 py-2 text-sm">
            <p className="flex justify-between">
              <b>{t.ticket}</b>
              <Badge tone={t.status === "open" ? "warn" : "good"}>{t.status === "open" ? "Open" : "Resolved"}</Badge>
            </p>
            <p className="text-ink-700">{t.message}</p>
            {t.resolution && <p className="mt-1 text-leaf-700">Shop: {t.resolution}</p>}
          </div>
        ))}
        <SupportForm orderId={o._id} />
        <p className="text-xs text-ink-500">
          Or call / WhatsApp {s.phone}. {!CUSTOMER_CANCELLABLE.includes(o.status) && o.status !== "cancelled" && o.status !== "delivered" && "Packing has started, so cancellations go through a support request."}
        </p>
      </Card>
    </div>
  );
}
