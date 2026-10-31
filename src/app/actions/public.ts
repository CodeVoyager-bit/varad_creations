"use server";
import { clientIp } from "@/lib/request";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/server/core";
import { geoAttribution, reverseGeocode } from "@/server/geo";
import { buildQuote, processReservationExpiries, type CartLineInput } from "@/server/orders";
import { loadSettings, serviceability } from "@/server/settings";

export async function checkPincode(pincode: string) {
  const s = await loadSettings();
  const r = serviceability(s, String(pincode).trim());
  return r.ok ? { ok: true as const, message: `Great — we deliver to ${pincode} within ${s.delivery.windowHours} hours of order confirmation.` } : { ok: false as const, message: r.reason };
}

export async function quoteCart(lines: CartLineInput[], couponCode?: string) {
  if (!Array.isArray(lines)) return null;
  if (!(await rateLimit(`quote:${await clientIp()}`, 120, 60))) return null;
  const session = await getSession();
  await processReservationExpiries();
  const { views, quote, settings } = await buildQuote(lines, { userId: session?.user.id, couponCode });
  return {
    lines: views,
    quote: { ...quote, lineDiscounts: undefined },
    freeAbovePaise: settings.delivery.freeAbovePaise,
    feePaise: settings.delivery.feePaise,
    signedIn: !!session,
  };
}
export type CartQuote = NonNullable<Awaited<ReturnType<typeof quoteCart>>>;

export async function locate(lat: number, lng: number) {
  if (!(await rateLimit(`geo:${await clientIp()}`, 6, 60))) return { error: "Too many location lookups. Please type your address." };
  const r = await reverseGeocode(lat, lng);
  if (!r) return { error: "Couldn't look up an address for this location. Please type it in." };
  const s = await loadSettings();
  const svc = r.pincode ? serviceability(s, r.pincode, { lat, lng }) : { ok: false as const, reason: "Please enter your pincode." };
  return { suggestion: r, attribution: geoAttribution, serviceable: svc.ok, message: svc.ok ? undefined : svc.reason };
}
