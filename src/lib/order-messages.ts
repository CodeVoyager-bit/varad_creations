import { rupees } from "./money";
import type { OrderDoc } from "./types";

type Msg = { label: string; text: string };
const day = (d: Date | string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(d));

/**
 * Ready-to-send WhatsApp updates for an order, matching where it is right now. The shop sends
 * them from its own WhatsApp (click-to-chat), so nothing goes out automatically.
 */
export function orderUpdateMessages(
  o: Pick<OrderDoc, "number" | "status" | "paymentMethod" | "paymentStatus" | "amountReceivedPaise"> & {
    address: { name: string };
    pricing: { totalPaise: number };
    expectedBy?: Date | string | null;
  },
  shop: string,
  orderLink: string,
): Msg[] {
  const hi = `Hi ${o.address.name.trim().split(/\s+/)[0]}`;
  const ref = `${shop} order #${o.number}`;
  const due = o.pricing.totalPaise - o.amountReceivedPaise;
  const m: Msg[] = [];
  if (o.paymentMethod === "upi" && o.paymentStatus === "awaiting_payment" && o.status !== "cancelled")
    m.push({ label: "Payment reminder", text: `${hi}, your ${ref} (${rupees(o.pricing.totalPaise)}) is waiting for UPI payment. You can pay and add the UPI reference here: ${orderLink}` });
  if (["confirmed", "packing", "ready_for_dispatch"].includes(o.status))
    m.push({ label: "Order confirmed", text: `${hi}, your ${ref} is confirmed${o.expectedBy ? ` and will reach you by ${day(o.expectedBy)}` : ""}. Track it here: ${orderLink}` });
  if (o.status === "out_for_delivery")
    m.push({ label: "Out for delivery", text: `${hi}, your ${ref} is out for delivery today.${o.paymentMethod === "cod" && due > 0 ? ` Please keep ${rupees(due)} ready.` : ""}` });
  if (o.status === "delivery_failed" || o.status === "rescheduled")
    m.push({ label: "Missed delivery", text: `${hi}, we couldn't deliver your ${ref}. Please reply with a time that suits you and we'll bring it over.` });
  if (o.status === "delivered") m.push({ label: "Thank you", text: `${hi}, thank you for ordering from ${shop}! Your order #${o.number} has been delivered. Order again any time: ${orderLink}` });
  m.push({ label: "General", text: `${hi}, this is ${shop} about your order #${o.number}.` });
  return m;
}
