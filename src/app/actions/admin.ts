"use server";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { C } from "@/lib/db";
import { toPaise } from "@/lib/money";
import { actorOf, requireAdmin } from "@/lib/session";
import type { BatchStatus, CouponDoc, PolicyContent, StorefrontContent } from "@/lib/types";
import { saveBrand, saveCategory, saveProduct, saveRedirect, saveVariant, setProductImages } from "@/server/catalog-admin";
import { AppError, audit } from "@/server/core";
import { createBatch, markDelivered, markFailed, reissueInvite, revokeBatch } from "@/server/delivery";
import { adjustStock, moveBatch, receiveStock } from "@/server/inventory";
import { addAdminNote, cancelOrder, confirmOrder, markReady, proposeSubstitution, rescheduleOrder, startPacking } from "@/server/orders";
import { completeRefund, initiateRefund, markNoPayment, reconcileCod, requestClarification, verifyUpiPayment } from "@/server/payments";
import { loadSettings } from "@/server/settings";
import { savePublicImage } from "@/server/storage";
import { TAGS } from "@/server/storefront";
import { createPartner, setUserDisabled } from "@/server/users";
import { siteUrl } from "@/lib/site";

export type AdminResult = { ok: true; message?: string; data?: Record<string, string> } | { ok: false; error: string };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => str(fd, k) || undefined;
const int = (fd: FormData, k: string, d = 0) => (str(fd, k) === "" ? d : Math.trunc(Number(str(fd, k))));
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const money = (fd: FormData, k: string) => toPaise(str(fd, k) || "0");
const optMoney = (fd: FormData, k: string) => (str(fd, k) ? toPaise(str(fd, k)) : null);
const optDate = (fd: FormData, k: string) => (str(fd, k) ? new Date(str(fd, k)) : null);

/** Every admin action: server-side role + 2FA + session-age check, then expected errors become messages. */
async function admin(fn: (a: ReturnType<typeof actorOf>) => Promise<string | void | { message?: string; data?: Record<string, string> }>): Promise<AdminResult> {
  const user = await requireAdmin();
  try {
    const r = await fn(actorOf(user));
    return typeof r === "object" ? { ok: true, ...r } : { ok: true, message: r || undefined };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_")) throw e;
    if (e instanceof Error && /Invalid amount/.test(e.message)) return { ok: false, error: "Enter amounts in rupees, e.g. 85 or 85.50." };
    console.error("[admin action]", (e as Error)?.message);
    return { ok: false, error: "Something went wrong. Nothing was changed if you see this message twice." };
  }
}

const stockChanged = () => updateTag(TAGS.catalog);

// ---------- orders ----------
export const acceptOrder = async (id: string) => admin(async (a) => (await confirmOrder(a, id), stockChanged(), "Order confirmed. The 48-hour delivery window has started."));
export const beginPacking = async (id: string) => admin(async (a) => void (await startPacking(a, id)));
export const orderReady = async (id: string) => admin(async (a) => (await markReady(a, id), "Stock deducted (earliest expiry first). Ready for dispatch."));
export const adminCancel = async (id: string, fd: FormData) => admin(async (a) => (await cancelOrder(a, id, str(fd, "reason")), stockChanged(), "Order cancelled."));
export const orderNote = async (id: string, fd: FormData) => admin(async (a) => void (await addAdminNote(a, id, str(fd, "text"))));
export const reschedule = async (id: string, fd: FormData) =>
  admin(async (a) => {
    const d = optDate(fd, "date");
    if (!d || isNaN(+d)) throw new AppError("Pick a date.");
    await rescheduleOrder(a, id, d, opt(fd, "note"));
  });
export const proposeSub = async (id: string, fd: FormData) =>
  admin(async (a) => {
    const changes: { index: number; variantId?: string; qty: number }[] = [];
    for (let i = 0; fd.has(`qty_${i}`); i++) {
      const qty = int(fd, `qty_${i}`, 0);
      const variantId = opt(fd, `variant_${i}`);
      changes.push({ index: i, qty, variantId });
    }
    await proposeSubstitution(a, id, changes, opt(fd, "note"));
    return "Sent to the customer for approval.";
  });
export const adminDelivered = async (id: string, fd: FormData) =>
  admin(async (a) => {
    const o = await C.orders.findOne({ _id: new ObjectId(id) });
    const cod = o?.paymentMethod === "cod" && o.paymentStatus === "cod_due" ? { method: (str(fd, "method") || "cash") as "cash" | "upi", amountPaise: money(fd, "amount"), reference: opt(fd, "reference") } : undefined;
    await markDelivered(a, "admin", id, { confirm: bool(fd, "confirm"), note: opt(fd, "note"), cod });
  });
export const adminFailed = async (id: string, fd: FormData) => admin(async (a) => void (await markFailed(a, "admin", id, str(fd, "reason"), opt(fd, "note"))));

// ---------- payments ----------
export const verifyPayment = async (id: string, fd: FormData) =>
  admin(async (a) => {
    await verifyUpiPayment(a, id, { amountPaise: money(fd, "amount"), note: opt(fd, "note"), accept: bool(fd, "accept") });
    stockChanged();
    return "Payment recorded as received.";
  });
export const clarifyPayment = async (id: string, fd: FormData) => admin(async (a) => (await requestClarification(a, id, str(fd, "message")), "Customer asked to check their payment."));
export const noPayment = async (id: string, fd: FormData) => admin(async (a) => void (await markNoPayment(a, id, str(fd, "note") || "No payment found")));
export const reconcile = async (fd: FormData) => admin(async (a) => `${await reconcileCod(a, fd.getAll("ids").map(String), opt(fd, "note"))} collection(s) settled.`);
export const refundStart = async (id: string, fd: FormData) => admin(async (a) => void (await initiateRefund(a, id, money(fd, "amount"), str(fd, "reason"))));
export const refundDone = async (id: string, fd: FormData) => admin(async (a) => void (await completeRefund(a, id, str(fd, "reference"))));

// ---------- catalog ----------
const seoOf = (fd: FormData) => ({ title: opt(fd, "seoTitle"), description: opt(fd, "seoDescription") });

export const saveCategoryA = async (fd: FormData) =>
  admin(async (a) => {
    const file = fd.get("image");
    const image = file instanceof File && file.size ? await savePublicImage(file, "categories") : undefined;
    await saveCategory(a, { id: opt(fd, "id"), name: str(fd, "name"), slug: opt(fd, "slug"), description: opt(fd, "description"), kind: str(fd, "kind") === "nonfood" ? "nonfood" : "food", visible: bool(fd, "visible"), sortOrder: int(fd, "sortOrder"), image, seo: seoOf(fd) });
    updateTag(TAGS.catalog);
    return "Category saved.";
  });

export const saveBrandA = async (fd: FormData) =>
  admin(async (a) => {
    const file = fd.get("logo");
    const logo = file instanceof File && file.size ? await savePublicImage(file, "brands") : undefined;
    await saveBrand(a, { id: opt(fd, "id"), name: str(fd, "name"), slug: opt(fd, "slug"), description: opt(fd, "description"), visible: bool(fd, "visible"), sortOrder: int(fd, "sortOrder"), logo, seo: seoOf(fd) });
    updateTag(TAGS.catalog);
    return "Brand saved.";
  });

const FOOD_KEYS = ["ingredients", "allergens", "additives", "nutrition", "dietary", "storage", "shelfLife", "manufacturer", "marketer", "fssaiLicence", "consumerCare", "instructions", "importer", "countryOfOrigin"] as const;
const NONFOOD_KEYS = ["material", "dimensions", "capacity", "care", "warranty", "manufacturer", "consumerCare", "importer", "countryOfOrigin"] as const;

export async function saveProductA(fd: FormData) {
  let newId = "";
  const r = await admin(async (a) => {
    const pick = (keys: readonly string[], prefix: string) => Object.fromEntries(keys.map((k) => [k, opt(fd, `${prefix}.${k}`)]).filter(([, v]) => v));
    newId = await saveProduct(a, {
      id: opt(fd, "id"),
      name: str(fd, "name"),
      slug: opt(fd, "slug"),
      brandId: str(fd, "brandId"),
      categoryId: str(fd, "categoryId"),
      kind: str(fd, "kind") === "nonfood" ? "nonfood" : "food",
      description: str(fd, "description"),
      status: (["draft", "active", "discontinued"].includes(str(fd, "status")) ? str(fd, "status") : "draft") as "draft",
      featured: bool(fd, "featured"),
      bestseller: bool(fd, "bestseller"),
      tags: str(fd, "tags").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      attributes: str(fd, "attributes")
        .split("\n")
        .map((l) => l.split(":"))
        .filter((p) => p.length > 1 && p[0].trim())
        .map(([label, ...v]) => ({ label: label.trim(), value: v.join(":").trim() })),
      food: pick(FOOD_KEYS, "food"),
      nonFood: pick(NONFOOD_KEYS, "nonFood"),
      seo: seoOf(fd),
    });
    updateTag(TAGS.catalog);
    return "Product saved.";
  });
  if (r.ok && !str(fd, "id")) redirect(`/admin/products/${newId}`);
  return r;
}

export const uploadProductImage = async (id: string, field: "images" | "labelImages", fd: FormData) =>
  admin(async (a) => {
    const p = await C.products.findOne({ _id: new ObjectId(id) });
    if (!p) throw new AppError("Product not found.");
    const urls = [...p[field]];
    for (const f of fd.getAll("files")) if (f instanceof File && f.size) urls.push(await savePublicImage(f, "products"));
    await setProductImages(a, id, field, urls);
    updateTag(TAGS.catalog);
  });

export const editProductImages = async (id: string, field: "images" | "labelImages", url: string, op: "remove" | "first") =>
  admin(async (a) => {
    const p = await C.products.findOne({ _id: new ObjectId(id) });
    if (!p) throw new AppError("Product not found.");
    const urls = p[field].filter((u) => u !== url);
    await setProductImages(a, id, field, op === "first" ? [url, ...urls] : urls);
    updateTag(TAGS.catalog);
  });

export const saveVariantA = async (fd: FormData) =>
  admin(async (a) => {
    const unit = opt(fd, "netUnit") as "g" | "kg" | "ml" | "l" | "pc" | undefined;
    await saveVariant(a, {
      id: opt(fd, "id"),
      productId: str(fd, "productId"),
      label: str(fd, "label"),
      sku: str(fd, "sku"),
      netQty: str(fd, "netQty") ? Number(str(fd, "netQty")) : undefined,
      netUnit: unit,
      mrpPaise: money(fd, "mrp"),
      pricePaise: money(fd, "price"),
      lowStockThreshold: int(fd, "lowStockThreshold", 5),
      active: bool(fd, "active"),
      sortOrder: int(fd, "sortOrder"),
    });
    updateTag(TAGS.catalog);
    return "Pack size saved.";
  });

// ---------- inventory ----------
export const receiveStockA = async (fd: FormData) =>
  admin(async (a) => {
    await receiveStock(a, { variantId: str(fd, "variantId"), qty: int(fd, "qty"), batchNo: str(fd, "batchNo"), expiryDate: optDate(fd, "expiryDate") ?? undefined, note: opt(fd, "note") });
    stockChanged();
    return "Stock received.";
  });
export const adjustStockA = async (fd: FormData) =>
  admin(async (a) => {
    await adjustStock(a, { variantId: str(fd, "variantId"), delta: int(fd, "delta"), reason: str(fd, "reason") });
    stockChanged();
    return "Stock adjusted.";
  });
export const moveBatchA = async (fd: FormData) =>
  admin(async (a) => {
    await moveBatch(a, { batchId: str(fd, "batchId"), qty: int(fd, "qty"), to: str(fd, "to") as BatchStatus, reason: str(fd, "reason") });
    stockChanged();
    return "Stock moved.";
  });
export const resolveAlert = async (id: string) =>
  admin(async (a) => {
    await C.alerts.updateOne({ _id: new ObjectId(id) }, { $set: { resolved: true } });
    await audit(a, "alert.resolve", "alert", id);
  });

// ---------- delivery ----------
export const createBatchA = async (fd: FormData) =>
  admin(async (a) => {
    const type = str(fd, "partnerType");
    const { batch, token } = await createBatch(a, {
      orderIds: fd.getAll("orderIds").map(String),
      partner: type === "temporary" ? { type, name: str(fd, "tempName"), phone: str(fd, "tempPhone"), accessHours: int(fd, "accessHours", 8) } : { type: "permanent", userId: str(fd, "partnerId") },
    });
    const data: Record<string, string> = { batchId: batch._id.toHexString() };
    if (token) Object.assign(data, { link: `${siteUrl}/delivery/join#${token}`, phone: batch.partnerPhone });
    return { message: `Batch ${batch.code} created.`, data };
  });
export const reissueInviteA = async (batchId: string) =>
  admin(async (a) => {
    const token = await reissueInvite(a, batchId);
    return { message: "New link issued. Previous links and sessions were ended.", data: { link: `${siteUrl}/delivery/join#${token}` } };
  });
export const revokeBatchA = async (batchId: string, fd: FormData) => admin(async (a) => (await revokeBatch(a, batchId, str(fd, "reason") || "Revoked by admin"), "Access revoked; undelivered orders are back in the dispatch queue."));
export const createPartnerA = async (fd: FormData) => admin(async (a) => (await createPartner(a, { name: str(fd, "name"), phone: str(fd, "phone") }), "Partner added. They set their password using “Forgot password” on the sign-in page."));
export const setDisabledA = async (userId: string, disabled: boolean) => admin(async (a) => void (await setUserDisabled(a, userId, disabled)));

// ---------- coupons ----------
export const saveCouponA = async (fd: FormData) =>
  admin(async (a) => {
    const code = str(fd, "code").toUpperCase();
    if (!/^[A-Z0-9-]{3,30}$/.test(code)) throw new AppError("Code: 3–30 letters, numbers or hyphens.");
    const type = str(fd, "type") === "percent" ? "percent" : "fixed";
    const value = type === "percent" ? int(fd, "value") : money(fd, "value");
    if (type === "percent" && (value < 1 || value > 100)) throw new AppError("Percent must be 1–100.");
    if (type === "fixed" && value <= 0) throw new AppError("Discount must be more than ₹0.");
    const ids = (k: string) => fd.getAll(k).map(String).filter(ObjectId.isValid).map((x) => new ObjectId(x));
    const limit = (k: string) => (str(fd, k) ? int(fd, k) : null);
    const doc: Partial<CouponDoc> = {
      code,
      description: opt(fd, "description"),
      type,
      value,
      minSubtotalPaise: money(fd, "minSubtotal"),
      maxDiscountPaise: optMoney(fd, "maxDiscount"),
      startsAt: optDate(fd, "startsAt"),
      endsAt: optDate(fd, "endsAt"),
      usageLimit: limit("usageLimit"),
      perCustomerLimit: limit("perCustomerLimit"),
      eligibleProductIds: ids("products"),
      eligibleCategoryIds: ids("categories"),
      eligibleBrandIds: ids("brands"),
      firstOrderOnly: bool(fd, "firstOrderOnly"),
      showOnStorefront: bool(fd, "showOnStorefront"),
      active: bool(fd, "active"),
      updatedAt: new Date(),
    };
    const id = opt(fd, "id");
    const before = id ? await C.coupons.findOne({ _id: new ObjectId(id) }) : null;
    if (await C.coupons.findOne({ code, ...(id ? { _id: { $ne: new ObjectId(id) } } : {}) })) throw new AppError("Another coupon already uses this code.");
    await C.coupons.updateOne({ _id: id ? new ObjectId(id) : new ObjectId() }, { $set: doc, $setOnInsert: { usedCount: 0, createdAt: new Date() } }, { upsert: true });
    await audit(a, before ? "coupon.update" : "coupon.create", "coupon", code, undefined, before, doc);
    updateTag(TAGS.catalog);
    return "Coupon saved.";
  });

// ---------- storefront & content (draft → preview → publish) ----------
export const saveStorefrontDraft = async (json: string) =>
  admin(async (a) => {
    const draft = JSON.parse(json) as StorefrontContent;
    if (!Array.isArray(draft.banners) || !Array.isArray(draft.collections)) throw new AppError("Invalid storefront content.");
    await C.content.updateOne({ _id: "storefront" }, { $set: { draft, updatedAt: new Date() }, $setOnInsert: { published: null } }, { upsert: true });
    await audit(a, "storefront.draft", "content", "storefront");
    return "Draft saved. Preview it, then publish.";
  });
export const uploadBannerImage = async (fd: FormData) => admin(async () => ({ data: { url: await savePublicImage(fd.get("file") as File, "banners") } }));
export const publishContent = async (key: string) =>
  admin(async (a) => {
    const doc = await C.content.findOne({ _id: key });
    if (!doc?.draft) throw new AppError("Nothing to publish.");
    await C.content.updateOne({ _id: key }, { $set: { published: doc.draft, publishedAt: new Date(), publishedBy: a.id } });
    await audit(a, "content.publish", "content", key, undefined, doc.published, doc.draft);
    updateTag(key === "storefront" ? TAGS.storefront : TAGS.policy(key.replace("policy:", "")));
    return "Published.";
  });
export const savePolicyDraft = async (slug: string, fd: FormData) =>
  admin(async (a) => {
    const draft: PolicyContent = { title: str(fd, "title"), body: String(fd.get("body") ?? ""), seoDescription: opt(fd, "seoDescription") };
    if (!draft.title) throw new AppError("Title is required.");
    await C.content.updateOne({ _id: `policy:${slug}` }, { $set: { draft, updatedAt: new Date() }, $setOnInsert: { published: null } }, { upsert: true });
    await audit(a, "policy.draft", "content", slug);
    return "Draft saved. Review the preview, then publish.";
  });
export const saveRedirectA = async (fd: FormData) => admin(async (a) => (await saveRedirect(a, str(fd, "from"), str(fd, "to")), updateTag(TAGS.redirects), "Redirect saved."));
export const deleteRedirectA = async (from: string) =>
  admin(async (a) => {
    await C.redirects.deleteOne({ from });
    await audit(a, "redirect.delete", "redirect", from);
    updateTag(TAGS.redirects);
  });

// ---------- business settings ----------
export const saveSettingsA = async (fd: FormData) =>
  admin(async (a) => {
    const before = await loadSettings();
    const file = fd.get("logo");
    const logoUrl = file instanceof File && file.size ? await savePublicImage(file, "site") : bool(fd, "removeLogo") ? undefined : before.logoUrl;
    const pins = str(fd, "pincodes").split(/[\s,]+/).filter((p) => /^\d{6}$/.test(p));
    if (!pins.length) throw new AppError("Add at least one serviceable pincode.");
    const delivery = {
      feePaise: money(fd, "deliveryFee"),
      freeAbovePaise: money(fd, "freeAbove"),
      windowHours: int(fd, "windowHours", 48),
      upiPaymentMinutes: int(fd, "upiPaymentMinutes", 30),
      verificationHoldHours: int(fd, "verificationHoldHours", 12),
      codAcceptHours: int(fd, "codAcceptHours", 24),
    };
    if (delivery.upiPaymentMinutes < 10 || delivery.verificationHoldHours < 1 || delivery.codAcceptHours < 1) throw new AppError("Payment/stock-hold windows are too short.");
    const next = {
      ...before,
      businessName: str(fd, "businessName") || before.businessName,
      tagline: str(fd, "tagline") || before.tagline,
      logoUrl,
      legalName: opt(fd, "legalName"),
      address: { line1: str(fd, "line1"), line2: opt(fd, "line2"), city: str(fd, "city"), state: str(fd, "state"), pincode: str(fd, "pincode") },
      phone: str(fd, "phone"),
      whatsapp: str(fd, "whatsapp").replace(/\D/g, ""),
      email: opt(fd, "email"),
      instagram: opt(fd, "instagram"),
      whatsappCatalog: opt(fd, "whatsappCatalog"),
      mapsUrl: opt(fd, "mapsUrl"),
      openingHours: opt(fd, "openingHours"),
      gstin: opt(fd, "gstin")?.toUpperCase(),
      fssaiLicence: opt(fd, "fssaiLicence"),
      grievance: { name: opt(fd, "grievanceName"), designation: opt(fd, "grievanceDesignation"), phone: opt(fd, "grievancePhone"), email: opt(fd, "grievanceEmail") },
      upi: { vpa: opt(fd, "upiVpa"), payeeName: opt(fd, "upiPayee") },
      delivery,
      service: { areasLabel: str(fd, "areasLabel") || "Pune and PCMC", pincodes: [...new Set(pins)].sort(), center: { lat: Number(str(fd, "centerLat")), lng: Number(str(fd, "centerLng")) }, radiusKm: Number(str(fd, "radiusKm")) || 35 },
      policy: { issueReportHours: str(fd, "issueReportHours") ? int(fd, "issueReportHours") : undefined, refundProcessingDays: str(fd, "refundProcessingDays") ? int(fd, "refundProcessingDays") : undefined },
      seo: { title: str(fd, "seoTitle") || before.seo.title, description: str(fd, "seoDescription") || before.seo.description },
      updatedAt: new Date(),
    };
    if (!Number.isFinite(next.service.center.lat) || !Number.isFinite(next.service.center.lng)) throw new AppError("Service centre coordinates are invalid.");
    if (next.upi.vpa && !/^[\w.-]{2,256}@[a-zA-Z][\w.-]{1,63}$/.test(next.upi.vpa)) throw new AppError("UPI ID looks invalid (expected name@bank).");
    await C.settings.replaceOne({ _id: "business" }, next, { upsert: true });
    await audit(a, "settings.update", "settings", "business", undefined, before, next);
    updateTag(TAGS.settings);
    updateTag(TAGS.catalog);
    return "Settings saved.";
  });

// ---------- support ----------
export const supportAck = async (id: string) =>
  admin(async (a) => {
    await C.support.updateOne({ _id: new ObjectId(id), acknowledgedAt: { $exists: false } }, { $set: { acknowledgedAt: new Date() } });
    await audit(a, "support.ack", "support", id);
  });
export const supportResolve = async (id: string, fd: FormData) =>
  admin(async (a) => {
    const resolution = str(fd, "resolution");
    if (!resolution) throw new AppError("Write the resolution the customer will see.");
    await C.support.updateOne({ _id: new ObjectId(id) }, { $set: { status: "resolved", resolution, resolvedAt: new Date(), resolvedBy: a.id }, $min: { acknowledgedAt: new Date() } });
    await audit(a, "support.resolve", "support", id, resolution);
  });
