"use client";
import { useSyncExternalStore } from "react";

/**
 * The cart lives on the device so shoppers can browse and build it before signing in;
 * it survives registration and sign-in. Snapshots are for display only — every price,
 * stock level and coupon is re-checked on the server for the quote and at checkout.
 */
export interface CartLine {
  variantId: string;
  qty: number;
  name: string;
  brand: string;
  label: string;
  pricePaise: number;
  mrpPaise: number;
  image?: string;
  slug: string;
}
export interface CartState {
  lines: CartLine[];
  coupon?: string;
  pincode?: string;
  area?: string;
}

const KEY = "vc-cart-v1";
const EMPTY: CartState = { lines: [] };
let state: CartState = EMPTY;
let loaded = false;
const subs = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    /* private mode / blocked storage: cart stays in memory */
  }
}

function save(next: CartState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  subs.forEach((f) => f());
}

if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    subs.forEach((f) => f());
  });

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
const snapshot = () => {
  load();
  return state;
};

export function useCart() {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export const MAX_QTY = 24;

export const cart = {
  get: snapshot,
  setQty(line: Omit<CartLine, "qty">, qty: number) {
    const s = snapshot();
    const q = Math.max(0, Math.min(MAX_QTY, qty));
    const rest = s.lines.filter((l) => l.variantId !== line.variantId);
    const existing = s.lines.find((l) => l.variantId === line.variantId);
    if (!q) return save({ ...s, lines: rest });
    const updated = { ...(existing ?? line), ...line, qty: q };
    save({ ...s, lines: existing ? s.lines.map((l) => (l.variantId === line.variantId ? updated : l)) : [...s.lines, updated] });
  },
  remove(variantId: string) {
    const s = snapshot();
    save({ ...s, lines: s.lines.filter((l) => l.variantId !== variantId) });
  },
  setCoupon(code?: string) {
    save({ ...snapshot(), coupon: code?.trim().toUpperCase() || undefined });
  },
  setLocation(pincode: string, area?: string) {
    save({ ...snapshot(), pincode, area });
  },
  clear() {
    const s = snapshot();
    save({ lines: [], pincode: s.pincode, area: s.area });
  },
};

export const qtyOf = (s: CartState, variantId: string) => s.lines.find((l) => l.variantId === variantId)?.qty ?? 0;
export const countOf = (s: CartState) => s.lines.reduce((a, l) => a + l.qty, 0);
export const estimateOf = (s: CartState) => s.lines.reduce((a, l) => a + l.qty * l.pricePaise, 0);
