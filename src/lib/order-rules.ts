import type { OrderStatus, PaymentStatus } from "./types";

/** Fulfilment. Payment is a separate machine below. */
export const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["packing", "cancelled"],
  packing: ["ready_for_dispatch", "cancelled"],
  ready_for_dispatch: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "delivery_failed"],
  delivery_failed: ["rescheduled", "cancelled"],
  rescheduled: ["out_for_delivery", "cancelled"],
  delivered: [],
  cancelled: [],
};

/**
 * paid after collection_recorded means admin reconciled the partner's COD collection.
 * void -> paid exists only for an admin recording money that arrived after an order was
 * cancelled; such an order then goes straight to refund_pending.
 */
export const PAYMENT_FLOW: Record<PaymentStatus, PaymentStatus[]> = {
  awaiting_payment: ["verification_pending", "paid", "void"],
  verification_pending: ["paid", "awaiting_payment", "void"],
  paid: ["refund_pending"],
  cod_due: ["collection_recorded", "void"],
  collection_recorded: ["paid", "refund_pending"],
  refund_pending: ["partially_refunded", "refunded"],
  partially_refunded: ["refund_pending"],
  refunded: [],
  void: ["paid"],
};

export const canMoveOrder = (from: OrderStatus, to: OrderStatus) => ORDER_FLOW[from].includes(to);
export const canMovePayment = (from: PaymentStatus, to: PaymentStatus) => PAYMENT_FLOW[from].includes(to);

/** Customers may cancel themselves only before packing starts. */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ["placed", "confirmed"];

export const ORDER_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  packing: "Packing",
  ready_for_dispatch: "Ready for dispatch",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  delivery_failed: "Delivery attempt unsuccessful",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  awaiting_payment: "Awaiting payment",
  verification_pending: "Payment verification pending",
  paid: "Paid",
  cod_due: "Cash on delivery due",
  collection_recorded: "Collected on delivery",
  refund_pending: "Refund pending",
  partially_refunded: "Partly refunded",
  refunded: "Refunded",
  void: "No payment due",
};

export const TRACK_STEPS: OrderStatus[] = ["placed", "confirmed", "packing", "ready_for_dispatch", "out_for_delivery", "delivered"];

export type Tone = "neutral" | "warn" | "good" | "bad" | "info";

export function orderTone(s: OrderStatus): Tone {
  if (s === "delivered") return "good";
  if (s === "cancelled" || s === "delivery_failed") return "bad";
  if (s === "placed" || s === "rescheduled") return "warn";
  return "info";
}

export function paymentTone(s: PaymentStatus): Tone {
  if (s === "paid" || s === "collection_recorded") return "good";
  if (s === "refunded" || s === "void") return "neutral";
  return "warn";
}
