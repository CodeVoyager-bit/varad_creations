/** All money is integer paise. Rupees only at the edges (display, forms). */
export function rupees(paise: number, opts: { decimals?: boolean } = {}) {
  const r = paise / 100;
  const decimals = opts.decimals ?? !Number.isInteger(r);
  return "₹" + r.toLocaleString("en-IN", { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: 2 });
}

/** "85.50" -> 8550. Rejects anything that is not a non-negative amount with at most 2 decimals. */
export function toPaise(input: string | number): number {
  const s = String(input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid amount: ${s}`);
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function percentOff(mrp: number, price: number) {
  return mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
}
