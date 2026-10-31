import Image from "next/image";
import { rupees } from "@/lib/money";
import { ORDER_LABEL, orderTone, PAYMENT_LABEL, paymentTone, TRACK_STEPS } from "@/lib/order-rules";
import type { Jsonify } from "@/lib/db";
import type { OrderDoc, OrderItem, OrderStatus, Pricing } from "@/lib/types";
import { PackArt } from "./product-card";
import { Badge, cx, fmtDate, Icon } from "./ui";

export type PlainOrder = Jsonify<OrderDoc>;

export function StatusBadges({ o }: { o: Pick<PlainOrder, "status" | "paymentStatus"> }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <Badge tone={orderTone(o.status)}>{ORDER_LABEL[o.status]}</Badge>
      <Badge tone={paymentTone(o.paymentStatus)}>{PAYMENT_LABEL[o.paymentStatus]}</Badge>
    </span>
  );
}

export function ItemList({ items }: { items: Jsonify<OrderItem>[] }) {
  return (
    <ul className="divide-y divide-cream-200">
      {items.map((i, k) => (
        <li key={k} className="flex items-center gap-3 py-2.5">
          <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-cream-50">
            {i.image ? <Image src={i.image} alt="" fill sizes="48px" className="object-contain" /> : <PackArt name={i.name} brand={i.brand} className="size-full" />}
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block truncate font-semibold">{i.name}</span>
            <span className="text-ink-500">
              {i.brand} · {i.variantLabel} · {i.qty} × {rupees(i.unitPricePaise)}
            </span>
            {i.batches?.length ? <span className="block text-xs text-ink-500">Batch {i.batches.map((b) => `${b.batchNo} (${b.qty})`).join(", ")}</span> : null}
          </span>
          <span className="text-sm font-semibold tabular-nums">{rupees(i.lineTotalPaise)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Bill({ p }: { p: Pricing | Jsonify<Pricing> }) {
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between">
        <dt className="text-ink-700">Item total</dt>
        <dd className="tabular-nums">{rupees(p.subtotalPaise)}</dd>
      </div>
      {p.discountPaise > 0 && (
        <>
          <div className="flex justify-between text-leaf-700">
            <dt>Coupon {p.couponCode}</dt>
            <dd className="tabular-nums">−{rupees(p.discountPaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-700">Subtotal after discount</dt>
            <dd className="tabular-nums">{rupees(p.discountedSubtotalPaise)}</dd>
          </div>
        </>
      )}
      <div className="flex justify-between">
        <dt className="text-ink-700">Delivery fee</dt>
        <dd className="tabular-nums">{p.deliveryFeePaise ? rupees(p.deliveryFeePaise) : "FREE"}</dd>
      </div>
      <div className="flex justify-between border-t border-cream-200 pt-1.5 font-bold">
        <dt>Total</dt>
        <dd className="tabular-nums">{rupees(p.totalPaise)}</dd>
      </div>
    </dl>
  );
}

export function Tracker({ o }: { o: PlainOrder }) {
  const when = (s: OrderStatus) => {
    const label = s === "placed" ? "Order placed" : ORDER_LABEL[s];
    return [...o.timeline].reverse().find((t) => t.event === label)?.at;
  };
  if (o.status === "cancelled")
    return (
      <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-600">
        <Icon name="close" className="size-4" /> Cancelled{o.cancelReason ? ` — ${o.cancelReason}` : ""}
      </p>
    );
  const reached = TRACK_STEPS.indexOf(o.status === "delivery_failed" || o.status === "rescheduled" ? "out_for_delivery" : o.status);
  return (
    <ol className="space-y-0">
      {TRACK_STEPS.map((s, i) => {
        const done = i <= reached;
        return (
          <li key={s} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span className={cx("grid size-6 place-items-center rounded-full", done ? "bg-leaf-600 text-white" : "border-2 border-cream-300 bg-white")}>{done && <Icon name="check" className="size-3.5" />}</span>
              {i < TRACK_STEPS.length - 1 && <span className={cx("h-6 w-0.5", i < reached ? "bg-leaf-600" : "bg-cream-300")} />}
            </span>
            <span className="-mt-0.5 text-sm">
              <span className={cx("font-semibold", !done && "text-ink-500")}>{ORDER_LABEL[s]}</span>
              {done && when(s) && <span className="ml-2 text-xs text-ink-500">{fmtDate(when(s))}</span>}
            </span>
          </li>
        );
      })}
      {(o.status === "delivery_failed" || o.status === "rescheduled") && (
        <li className="mt-2 rounded-xl bg-saffron-50 px-3 py-2 text-sm text-saffron-700">
          {o.status === "delivery_failed" ? "We couldn't deliver on our last attempt. The shop will contact you to arrange a new time." : `Rescheduled${o.delivery.rescheduledFor ? ` for ${fmtDate(o.delivery.rescheduledFor, false)}` : ""}.`}
        </li>
      )}
    </ol>
  );
}

export const addressLines = (a: PlainOrder["address"]) => [
  `${a.name} · ${a.phone}`,
  `${a.flat}, ${a.building}`,
  `${a.street}${a.landmark ? `, near ${a.landmark}` : ""}`,
  `${a.city} ${a.pincode}`,
];
