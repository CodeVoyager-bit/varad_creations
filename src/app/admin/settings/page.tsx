import { saveSettingsA } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin-ui";
import { Button, Card, Field, Input, Notice, Textarea } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { launchGaps } from "@/lib/settings-defaults";
import { otpMode } from "@/server/otp";
import { loadSettings } from "@/server/settings";

export const metadata = { title: "Settings" };

const rs = (p: number) => (p / 100).toFixed(2);

export default async function Settings() {
  await requireAdmin();
  const s = await loadSettings();
  const gaps = launchGaps(s);
  const integrations: [string, boolean, string][] = [
    ["OTP (MiniMoth)", otpMode === "minimoth", otpMode === "dev-console" ? "development: codes printed in server log" : otpMode === "unconfigured" ? "MINIMOTH_API_KEY missing — registration & password reset are disabled" : "configured"],
    ["Image storage (Vercel Blob)", !!process.env.BLOB_READ_WRITE_TOKEN, process.env.BLOB_READ_WRITE_TOKEN ? "configured" : process.env.NODE_ENV === "production" ? "BLOB_READ_WRITE_TOKEN missing — uploads disabled" : "development: saved to public/uploads"],
    ["Address lookup", true, process.env.GEOCODER_URL ? `custom: ${new URL(process.env.GEOCODER_URL).host}` : "public OpenStreetMap Nominatim (low volume only)"],
    ["Scheduled jobs", !!process.env.CRON_SECRET, process.env.CRON_SECRET ? "CRON_SECRET set" : "CRON_SECRET missing — cron endpoint refuses requests"],
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="font-display text-2xl font-semibold text-burgundy-700">Business settings</h1>
      {gaps.length > 0 && (
        <Notice tone="warn" title="Missing before launch">
          {gaps.join(" · ")}
        </Notice>
      )}
      <Card className="p-4 text-sm">
        <h2 className="mb-2 font-semibold">Integrations (secrets live in server environment variables, never here)</h2>
        <ul className="space-y-1">
          {integrations.map(([n, ok, note]) => (
            <li key={n}>
              <span className={ok ? "text-leaf-700" : "text-saffron-700"}>{ok ? "●" : "○"}</span> <b>{n}</b> — {note}
            </li>
          ))}
        </ul>
      </Card>
      <ActionForm action={saveSettingsA} className="space-y-4" confirm="Save business settings? Changes apply to the live store.">
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Identity</h2>
          <Field label="Business name">
            <Input name="businessName" defaultValue={s.businessName} required />
          </Field>
          <Field label="Registered legal name">
            <Input name="legalName" defaultValue={s.legalName} placeholder="As on registration documents" />
          </Field>
          <Field label="Tagline" className="sm:col-span-2">
            <Input name="tagline" defaultValue={s.tagline} />
          </Field>
          <Field label="Logo (PNG/JPEG/WebP)">
            <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="text-sm" />
          </Field>
          {s.logoUrl && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="removeLogo" /> Remove current logo (use temporary wordmark)
            </label>
          )}
          <Field label="FSSAI registration / licence no. (shop)">
            <Input name="fssaiLicence" defaultValue={s.fssaiLicence} />
          </Field>
          <Field label="GSTIN (leave blank if not registered)">
            <Input name="gstin" defaultValue={s.gstin} />
          </Field>
        </Card>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Address & contact</h2>
          <Field label="Address line 1">
            <Input name="line1" defaultValue={s.address.line1} required />
          </Field>
          <Field label="Address line 2">
            <Input name="line2" defaultValue={s.address.line2} />
          </Field>
          <Field label="City">
            <Input name="city" defaultValue={s.address.city} required />
          </Field>
          <Field label="State">
            <Input name="state" defaultValue={s.address.state} required />
          </Field>
          <Field label="Pincode">
            <Input name="pincode" defaultValue={s.address.pincode} required />
          </Field>
          <Field label="Phone (shown to customers)">
            <Input name="phone" defaultValue={s.phone} required />
          </Field>
          <Field label="WhatsApp number (with country code, digits)">
            <Input name="whatsapp" defaultValue={s.whatsapp} required />
          </Field>
          <Field label="Support email">
            <Input name="email" type="email" defaultValue={s.email} />
          </Field>
          <Field label="Opening / support hours">
            <Input name="openingHours" defaultValue={s.openingHours} placeholder="e.g. 9 am – 9 pm, all days" />
          </Field>
          <Field label="Instagram URL">
            <Input name="instagram" defaultValue={s.instagram} />
          </Field>
          <Field label="WhatsApp catalog URL">
            <Input name="whatsappCatalog" defaultValue={s.whatsappCatalog} />
          </Field>
          <Field label="Google Maps URL">
            <Input name="mapsUrl" defaultValue={s.mapsUrl} />
          </Field>
        </Card>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Grievance officer (shown on policy pages)</h2>
          <Field label="Name">
            <Input name="grievanceName" defaultValue={s.grievance.name} />
          </Field>
          <Field label="Designation">
            <Input name="grievanceDesignation" defaultValue={s.grievance.designation} />
          </Field>
          <Field label="Phone">
            <Input name="grievancePhone" defaultValue={s.grievance.phone} />
          </Field>
          <Field label="Email">
            <Input name="grievanceEmail" type="email" defaultValue={s.grievance.email} />
          </Field>
        </Card>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">UPI payee (shown to customers on the payment screen)</h2>
          <Field label="UPI ID (VPA)" hint="Must be the business account you check for payments.">
            <Input name="upiVpa" defaultValue={s.upi.vpa} placeholder="name@bank" />
          </Field>
          <Field label="Payee name (as shown in UPI apps)">
            <Input name="upiPayee" defaultValue={s.upi.payeeName} />
          </Field>
        </Card>
        <Card className="grid gap-3 p-4 sm:grid-cols-3">
          <h2 className="font-semibold sm:col-span-3">Delivery, payment windows & stock holds</h2>
          <Field label="Delivery fee ₹">
            <Input name="deliveryFee" defaultValue={rs(s.delivery.feePaise)} />
          </Field>
          <Field label="Free delivery from ₹ (after discounts)">
            <Input name="freeAbove" defaultValue={rs(s.delivery.freeAbovePaise)} />
          </Field>
          <Field label="Delivery promise (hours after confirmation)">
            <Input name="windowHours" type="number" defaultValue={s.delivery.windowHours} />
          </Field>
          <Field label="UPI payment window (minutes)" hint="Stock is held this long for unpaid UPI orders.">
            <Input name="upiPaymentMinutes" type="number" min={10} defaultValue={s.delivery.upiPaymentMinutes} />
          </Field>
          <Field label="Hold while verifying UPI (hours)">
            <Input name="verificationHoldHours" type="number" min={1} defaultValue={s.delivery.verificationHoldHours} />
          </Field>
          <Field label="Hold for COD acceptance (hours)">
            <Input name="codAcceptHours" type="number" min={1} defaultValue={s.delivery.codAcceptHours} />
          </Field>
          <Field label="Report issues within (hours of delivery)" hint="Used in policies and bills. Leave blank until decided.">
            <Input name="issueReportHours" type="number" defaultValue={s.policy.issueReportHours} />
          </Field>
          <Field label="Refund processing (days)" hint="Leave blank until decided.">
            <Input name="refundProcessingDays" type="number" defaultValue={s.policy.refundProcessingDays} />
          </Field>
        </Card>
        <Card className="grid gap-3 p-4 sm:grid-cols-3">
          <h2 className="font-semibold sm:col-span-3">Service area</h2>
          <Field label="Area label" className="sm:col-span-3">
            <Input name="areasLabel" defaultValue={s.service.areasLabel} />
          </Field>
          <Field label="Serviceable pincodes" hint="Starter list for Pune + PCMC — verify against real routes." className="sm:col-span-3">
            <Textarea name="pincodes" defaultValue={s.service.pincodes.join(", ")} rows={4} className="font-mono text-xs" />
          </Field>
          <Field label="Centre latitude">
            <Input name="centerLat" defaultValue={s.service.center.lat} />
          </Field>
          <Field label="Centre longitude">
            <Input name="centerLng" defaultValue={s.service.center.lng} />
          </Field>
          <Field label="Radius (km) for pinned locations">
            <Input name="radiusKm" defaultValue={s.service.radiusKm} />
          </Field>
        </Card>
        <Card className="grid gap-3 p-4">
          <h2 className="font-semibold">Default search listing</h2>
          <Field label="Site title">
            <Input name="seoTitle" defaultValue={s.seo.title} maxLength={70} />
          </Field>
          <Field label="Site description">
            <Input name="seoDescription" defaultValue={s.seo.description} maxLength={170} />
          </Field>
        </Card>
        <Button size="lg">Save settings</Button>
      </ActionForm>
    </div>
  );
}
