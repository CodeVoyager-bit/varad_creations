"use client";
import { useState, useTransition } from "react";
import { locate } from "@/app/actions/public";
import { saveAddress, type AddressInput } from "@/app/actions/customer";
import { Button, Field, Icon, Input, Notice, Textarea } from "./ui";

export interface SavedAddress extends AddressInput {
  id: string;
}

/**
 * Device coordinates only pre-fill a suggestion; the customer always confirms or corrects every
 * field. Location permission is requested only when "Use my location" is tapped.
 */
export function AddressForm({ initial, defaultName, defaultPhone, onSaved, onCancel }: { initial?: SavedAddress; defaultName?: string; defaultPhone?: string; onSaved: (id: string) => void; onCancel?: () => void }) {
  const [a, setA] = useState<AddressInput>(
    initial ?? { label: "Home", name: defaultName ?? "", phone: defaultPhone?.replace(/^\+91/, "") ?? "", flat: "", building: "", street: "", landmark: "", pincode: "", city: "Pune", instructions: "" },
  );
  const [msg, setMsg] = useState<{ tone: "info" | "bad" | "good"; text: string; attribution?: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setA({ ...a, [k]: e.target.value });

  function useLocation() {
    if (!("geolocation" in navigator)) return setMsg({ tone: "bad", text: "Location isn't available here. Please type your address." });
    setMsg({ tone: "info", text: "Finding your location…" });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        start(async () => {
          const { latitude: lat, longitude: lng } = pos.coords;
          const r = await locate(lat, lng);
          if ("error" in r) {
            setA((x) => ({ ...x, lat, lng }));
            return setMsg({ tone: "bad", text: r.error! });
          }
          const g = r.suggestion;
          setA((x) => ({ ...x, lat, lng, street: x.street || [g.street, g.locality].filter(Boolean).join(", "), pincode: g.pincode || x.pincode, city: g.city || x.city }));
          setMsg({
            tone: r.serviceable ? "good" : "bad",
            text: r.serviceable ? "We filled in what we could. Please check every field and add your flat and building." : r.message!,
            attribution: r.attribution,
          });
        }),
      (err) => setMsg({ tone: "bad", text: err.code === err.PERMISSION_DENIED ? "Location permission denied — please type your address below." : "Couldn't get your location. Please type your address." }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveAddress({ ...a, id: initial?.id });
      if (!r.ok) return setMsg({ tone: "bad", text: r.error });
      onSaved(r.id);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <button type="button" onClick={useLocation} disabled={pending} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-burgundy-600/30 bg-white text-sm font-semibold text-burgundy-700">
        <Icon name="locate" className="size-5" /> Use my location
      </button>
      {msg && (
        <Notice tone={msg.tone}>
          {msg.text}
          {msg.attribution && <span className="mt-1 block text-[11px] opacity-70">Address data {msg.attribution}</span>}
        </Notice>
      )}
      {a.lat != null && (
        <p className="flex items-center justify-between rounded-lg bg-cream-100 px-3 py-2 text-xs text-ink-500">
          Location pinned ({a.lat.toFixed(4)}, {a.lng?.toFixed(4)})
          <button type="button" className="font-semibold text-burgundy-700" onClick={() => setA({ ...a, lat: undefined, lng: undefined })}>
            Remove pin
          </button>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Recipient name" className="col-span-2 sm:col-span-1">
          <Input required autoComplete="name" value={a.name} onChange={set("name")} />
        </Field>
        <Field label="Mobile number" className="col-span-2 sm:col-span-1">
          <Input required type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={a.phone} onChange={(e) => setA({ ...a, phone: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <Field label="Flat / house no." className="col-span-2 sm:col-span-1">
          <Input required autoComplete="address-line1" value={a.flat} onChange={set("flat")} />
        </Field>
        <Field label="Building / society" className="col-span-2 sm:col-span-1">
          <Input required value={a.building} onChange={set("building")} />
        </Field>
        <Field label="Street / locality" className="col-span-2">
          <Input required autoComplete="address-line2" value={a.street} onChange={set("street")} />
        </Field>
        <Field label="Landmark (optional)" className="col-span-2">
          <Input value={a.landmark ?? ""} onChange={set("landmark")} />
        </Field>
        <Field label="Pincode">
          <Input required inputMode="numeric" autoComplete="postal-code" maxLength={6} value={a.pincode} onChange={(e) => setA({ ...a, pincode: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <Field label="City">
          <Input required autoComplete="address-level2" value={a.city} onChange={set("city")} />
        </Field>
        <Field label="Delivery instructions (optional)" className="col-span-2">
          <Textarea rows={2} maxLength={200} value={a.instructions ?? ""} onChange={set("instructions")} placeholder="e.g. Call before arriving…" />
        </Field>
        <Field label="Save as" className="col-span-2">
          <div className="flex gap-2">
            {["Home", "Work", "Other"].map((l) => (
              <button type="button" key={l} onClick={() => setA({ ...a, label: l })} aria-pressed={a.label === l} className={`h-9 rounded-full border px-4 text-sm font-semibold ${a.label === l ? "border-burgundy-600 bg-burgundy-50 text-burgundy-700" : "border-cream-300 bg-white"}`}>
                {l}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button disabled={pending} className="flex-1">
          {pending ? "Saving…" : "Save address"}
        </Button>
      </div>
    </form>
  );
}
