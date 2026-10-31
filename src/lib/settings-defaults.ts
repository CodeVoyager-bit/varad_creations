export interface SettingsDoc {
  _id: "business";
  businessName: string;
  tagline: string;
  logoUrl?: string;
  legalName?: string;
  address: { line1: string; line2?: string; city: string; state: string; pincode: string };
  phone: string;
  whatsapp: string;
  email?: string;
  instagram?: string;
  whatsappCatalog?: string;
  mapsUrl?: string;
  openingHours?: string;
  gstin?: string;
  fssaiLicence?: string;
  grievance: { name?: string; designation?: string; phone?: string; email?: string };
  upi: { vpa?: string; payeeName?: string };
  delivery: {
    feePaise: number;
    freeAbovePaise: number;
    windowHours: number;
    upiPaymentMinutes: number;
    verificationHoldHours: number;
    codAcceptHours: number;
  };
  service: {
    areasLabel: string;
    pincodes: string[];
    center: { lat: number; lng: number };
    radiusKm: number;
  };
  /** customer-facing service commitments; left blank until the owner decides (never invented) */
  policy: { issueReportHours?: number; refundProcessingDays?: number };
  seo: { title: string; description: string };
  updatedAt?: Date;
}

/**
 * Starting pincode list for Pune city + PCMC. Verify every entry against the
 * actual delivery routes before launch (admin > Settings > Service area).
 */
const PUNE_PCMC_PINCODES = [
  "411001", "411002", "411003", "411004", "411005", "411006", "411007", "411008", "411009", "411011",
  "411012", "411013", "411014", "411015", "411016", "411017", "411018", "411019", "411020", "411021",
  "411022", "411023", "411024", "411025", "411026", "411027", "411028", "411030", "411031", "411032",
  "411033", "411034", "411035", "411036", "411037", "411038", "411039", "411040", "411041", "411042",
  "411043", "411044", "411045", "411046", "411047", "411048", "411051", "411052", "411057", "411058",
  "411060", "411061", "411062", "412307", "412308",
];

export const DEFAULT_SETTINGS: SettingsDoc = {
  _id: "business",
  businessName: "Varad Creation",
  tagline: "Indori favourites, delivered across Pune and PCMC",
  address: {
    line1: "Sadhana Society, Hadapsar",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411028",
  },
  phone: "+91 98900 28882",
  whatsapp: "919890028882",
  instagram: "https://www.instagram.com/varadcreations2020/",
  whatsappCatalog: "https://wa.me/c/919890028882",
  grievance: {},
  upi: {},
  delivery: {
    feePaise: 5000,
    freeAbovePaise: 60000,
    windowHours: 48,
    upiPaymentMinutes: 30,
    verificationHoldHours: 12,
    codAcceptHours: 24,
  },
  service: {
    areasLabel: "Pune and PCMC",
    pincodes: PUNE_PCMC_PINCODES,
    center: { lat: 18.5204, lng: 73.8567 },
    radiusKm: 35,
  },
  policy: {},
  seo: {
    title: "Varad Creation — Indori namkeen & snacks delivered in Pune and PCMC",
    description:
      "Branded packaged Indori namkeen, snacks, bakery and pickles from Hadapsar, Pune. Delivered across Pune and PCMC within 48 hours of order confirmation.",
  },
};

/** Facts we must not invent. Shown to admin until filled in. */
export function launchGaps(s: SettingsDoc): string[] {
  const gaps: string[] = [];
  if (!s.legalName) gaps.push("Registered legal name of the business");
  if (!s.fssaiLicence) gaps.push("FSSAI registration/licence number of the shop");
  if (!s.gstin) gaps.push("GSTIN (or confirm the business is not GST-registered)");
  if (!s.email) gaps.push("Support email address");
  if (!s.grievance.name || !s.grievance.phone || !s.grievance.email) gaps.push("Grievance officer name, phone and email");
  if (!s.upi.vpa || !s.upi.payeeName) gaps.push("UPI ID and payee name for customer payments");
  if (!s.openingHours) gaps.push("Opening / support hours");
  if (!s.policy.issueReportHours) gaps.push("How soon after delivery customers must report wrong/damaged/expired items");
  if (!s.policy.refundProcessingDays) gaps.push("Refund processing time stated in policies and on bills");
  if (!s.logoUrl) gaps.push("Final logo (a temporary wordmark is shown)");
  return gaps;
}
