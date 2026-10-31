import { C } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { rateLimit } from "./core";

/**
 * Reverse geocoding only (coordinates -> address suggestion), called once when a customer
 * taps "Use my location". No autocomplete: the public OpenStreetMap Nominatim service forbids
 * autocomplete and heavy use (max 1 request/second, identifying User-Agent, attribution).
 * For production volume point GEOCODER_URL at a Nominatim-compatible paid/free-tier provider
 * (e.g. LocationIQ /v1/reverse) and set GEOCODER_KEY.
 */
const ENDPOINT = process.env.GEOCODER_URL ?? "https://nominatim.openstreetmap.org/reverse";
const KEY = process.env.GEOCODER_KEY;
export const geoAttribution = ENDPOINT.includes("openstreetmap") || ENDPOINT.includes("locationiq") ? "© OpenStreetMap contributors" : "";

export interface GeoSuggestion {
  street: string;
  locality: string;
  city: string;
  pincode: string;
  label: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoSuggestion | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const id = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = await C.geoCache.findOne({ _id: id });
  if (cached) return cached.result as GeoSuggestion | null;
  if (!(await rateLimit("geo:global", 1, 1))) return null; // provider limit; the form still works manually

  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({ format: "jsonv2", lat: String(lat), lon: String(lng), addressdetails: "1", zoom: "18", ...(KEY ? { key: KEY } : {}) }).toString();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": `VaradCreationStore/1.0 (+${siteUrl})`, "Accept-Language": "en" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    const a = j.address ?? {};
    const result: GeoSuggestion = {
      street: [a.house_number, a.road].filter(Boolean).join(" "),
      locality: a.neighbourhood ?? a.suburb ?? a.city_district ?? a.quarter ?? "",
      city: a.city ?? a.town ?? a.village ?? a.county ?? "Pune",
      pincode: (a.postcode ?? "").replace(/\s/g, "").slice(0, 6),
      label: j.display_name ?? "",
    };
    await C.geoCache.updateOne({ _id: id }, { $set: { result, expiresAt: new Date(Date.now() + 30 * 86400_000) } }, { upsert: true });
    return result;
  } catch {
    return null;
  }
}
