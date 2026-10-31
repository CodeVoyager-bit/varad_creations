"use client";
import { useState } from "react";
import type { AdminResult } from "@/app/actions/admin";
import { ActionForm, InviteLink } from "./admin-ui";
import { Button, Field, Input, Select } from "./ui";

export function BatchCreator({ action, orders, partners }: { action: (fd: FormData) => Promise<AdminResult>; orders: { id: string; label: string }[]; partners: { id: string; name: string }[] }) {
  const [type, setType] = useState<"permanent" | "temporary">(partners.length ? "permanent" : "temporary");
  const [invite, setInvite] = useState<{ link: string; phone?: string } | null>(null);
  return (
    <div className="space-y-3">
      <ActionForm action={action} onDone={(r) => setInvite(r.ok && r.data?.link ? { link: r.data.link, phone: r.data.phone } : null)} className="space-y-3">
        <fieldset className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-cream-200 p-2">
          <legend className="px-1 text-sm font-semibold">Orders ready for dispatch</legend>
          {orders.length ? (
            orders.map((o) => (
              <label key={o.id} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-cream-50">
                <input type="checkbox" name="orderIds" value={o.id} className="accent-burgundy-600" /> {o.label}
              </label>
            ))
          ) : (
            <p className="p-2 text-sm text-ink-500">No unassigned orders are ready.</p>
          )}
        </fieldset>
        <div className="flex gap-2" role="radiogroup" aria-label="Partner type">
          {(["permanent", "temporary"] as const).map((t) => (
            <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold ${type === t ? "border-burgundy-600 bg-burgundy-50" : "border-cream-300 bg-white"}`}>
              <input type="radio" name="partnerType" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
              {t === "permanent" ? "Our staff" : "Temporary / third party"}
            </label>
          ))}
        </div>
        {type === "permanent" ? (
          <Field label="Partner">
            <Select name="partnerId" required>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Name">
              <Input name="tempName" required />
            </Field>
            <Field label="Mobile (10 digits)">
              <Input name="tempPhone" inputMode="numeric" maxLength={10} required />
            </Field>
            <Field label="Access for (hours)" hint="Ends earlier if the batch completes.">
              <Input name="accessHours" type="number" min={1} max={24} defaultValue={8} />
            </Field>
          </div>
        )}
        <Button disabled={!orders.length}>Create batch</Button>
      </ActionForm>
      {invite && <InviteLink link={invite.link} phone={invite.phone} />}
    </div>
  );
}

export function ReissueButton({ action }: { action: () => Promise<AdminResult> }) {
  const [res, setRes] = useState<AdminResult | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          if (!confirm("Only reissue after confirming the partner's identity (e.g. by phone). Old links and sessions will stop working.")) return;
          setBusy(true);
          setRes(await action());
          setBusy(false);
        }}
      >
        Reissue access link
      </Button>
      {res?.ok && res.data?.link && <InviteLink link={res.data.link} />}
      {res && !res.ok && <p className="text-sm text-danger-600">{res.error}</p>}
    </div>
  );
}
