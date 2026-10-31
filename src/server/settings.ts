import { C } from "@/lib/db";
import { DEFAULT_SETTINGS, type SettingsDoc } from "@/lib/settings-defaults";

/** Stored settings merged over defaults, so new fields always have a value. */
export async function loadSettings(): Promise<SettingsDoc> {
  const s = await C.settings.findOne({ _id: "business" });
  if (!s) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    address: { ...DEFAULT_SETTINGS.address, ...s.address },
    grievance: { ...DEFAULT_SETTINGS.grievance, ...s.grievance },
    upi: { ...DEFAULT_SETTINGS.upi, ...s.upi },
    delivery: { ...DEFAULT_SETTINGS.delivery, ...s.delivery },
    service: { ...DEFAULT_SETTINGS.service, ...s.service },
    policy: { ...DEFAULT_SETTINGS.policy, ...s.policy },
    seo: { ...DEFAULT_SETTINGS.seo, ...s.seo },
  };
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Pincode must be on the list; coordinates, when present, must fall inside the service radius. */
export function serviceability(s: SettingsDoc, pincode: string, coords?: { lat?: number; lng?: number }) {
  if (!/^\d{6}$/.test(pincode)) return { ok: false as const, reason: "Enter a valid 6-digit pincode." };
  if (!s.service.pincodes.includes(pincode))
    return { ok: false as const, reason: `Sorry, we don't deliver to ${pincode} yet. We currently deliver across ${s.service.areasLabel}.` };
  if (coords?.lat != null && coords?.lng != null && distanceKm(s.service.center, { lat: coords.lat, lng: coords.lng }) > s.service.radiusKm)
    return { ok: false as const, reason: "The pinned location looks outside our delivery area. Please check the address or remove the pin." };
  return { ok: true as const };
}
