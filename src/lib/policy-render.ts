import { rupees } from "./money";
import type { SettingsDoc } from "./settings-defaults";
import { siteUrl } from "./site";

/** Values policies may reference as {{key}}. Missing ones render as a visible "to be added" marker. */
export function policyVars(s: Omit<SettingsDoc, "upi" | "updatedAt">): Record<string, string | undefined> {
  const a = s.address;
  return {
    businessName: s.businessName,
    legalName: s.legalName,
    address: `${a.line1}${a.line2 ? `, ${a.line2}` : ""}, ${a.city}, ${a.state} ${a.pincode}`,
    phone: s.phone,
    whatsapp: s.whatsapp ? `+${s.whatsapp}` : undefined,
    email: s.email,
    hours: s.openingHours,
    fssai: s.fssaiLicence,
    gstin: s.gstin,
    instagram: s.instagram,
    grievanceName: s.grievance.name,
    grievanceDesignation: s.grievance.designation,
    grievancePhone: s.grievance.phone,
    grievanceEmail: s.grievance.email,
    areas: s.service.areasLabel,
    windowHours: String(s.delivery.windowHours),
    deliveryFee: rupees(s.delivery.feePaise),
    freeAbove: rupees(s.delivery.freeAbovePaise),
    upiMinutes: String(s.delivery.upiPaymentMinutes),
    issueReportHours: s.policy.issueReportHours ? String(s.policy.issueReportHours) : undefined,
    refundProcessingDays: s.policy.refundProcessingDays ? String(s.policy.refundProcessingDays) : undefined,
    siteUrl,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string, vars: Record<string, string | undefined>) {
  return esc(s)
    .replace(/\{\{(\w+)\}\}/g, (_, k: string) => (vars[k] ? esc(vars[k]!) : `<mark>[to be added: ${k}]</mark>`))
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text: string, url: string) => (/^(https?:|mailto:|tel:|\/)/.test(url) ? `<a href="${url}">${text}</a>` : m));
}

/**
 * Minimal Markdown (## / ### headings, "- " lists, paragraphs, **bold**, [links](url)).
 * Everything is HTML-escaped first, so admin-entered text can't inject markup.
 */
export function renderPolicy(md: string, vars: Record<string, string | undefined>) {
  const out: string[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "), vars)}</p>`);
    if (list.length) out.push(`<ul>${list.map((l) => `<li>${inline(l, vars)}</li>`).join("")}</ul>`);
    para = [];
    list = [];
  };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) flush();
    else if (line.startsWith("### ") || line.startsWith("## ")) {
      flush();
      const h = line.startsWith("### ") ? 3 : 2;
      out.push(`<h${h}>${inline(line.slice(h + 1), vars)}</h${h}>`);
    } else if (line.startsWith("- ")) {
      if (para.length) flush();
      list.push(line.slice(2));
    } else {
      if (list.length) flush();
      para.push(line);
    }
  }
  flush();
  return out.join("\n");
}
