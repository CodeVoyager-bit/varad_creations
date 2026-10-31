import QRCode from "qrcode";

/**
 * Standard UPI deep link. Opening it (or returning from the app) proves nothing:
 * payment is confirmed only when an admin sees the money in the business account.
 */
export function upiLink(i: { vpa: string; payee: string; amountPaise: number; orderNumber: string }) {
  // the VPA stays literal (several UPI apps don't decode %40); settings only accept [\w.-]@[\w.-]
  const vpa = i.vpa.replace(/[^\w.@-]/g, "");
  return `upi://pay?pa=${vpa}&pn=${encodeURIComponent(i.payee)}&am=${(i.amountPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${i.orderNumber}`)}`;
}

export const upiQrSvg = (link: string) => QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#24170f", light: "#ffffff" } });
