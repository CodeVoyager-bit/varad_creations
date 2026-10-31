import type { ObjectId } from "mongodb";

export type Role = "customer" | "admin" | "delivery";

export interface Seo {
  title?: string;
  description?: string;
}

export interface CategoryDoc {
  _id: ObjectId;
  slug: string;
  name: string;
  description?: string;
  image?: string;
  kind: "food" | "nonfood";
  visible: boolean;
  sortOrder: number;
  seo?: Seo;
  isDemo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandDoc {
  _id: ObjectId;
  slug: string;
  name: string;
  logo?: string;
  description?: string;
  visible: boolean;
  sortOrder: number;
  seo?: Seo;
  isDemo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Declarations copied from the pack label. Never filled with guesses. */
export interface FoodInfo {
  ingredients?: string;
  additives?: string;
  allergens?: string;
  nutrition?: string;
  dietary?: "veg" | "nonveg" | "";
  storage?: string;
  shelfLife?: string;
  manufacturer?: string;
  marketer?: string;
  /** brand owner's FSSAI licence number as printed on the pack */
  fssaiLicence?: string;
  consumerCare?: string;
  instructions?: string;
  importer?: string;
  countryOfOrigin?: string;
}

export interface NonFoodInfo {
  material?: string;
  dimensions?: string;
  capacity?: string;
  care?: string;
  warranty?: string;
  manufacturer?: string;
  consumerCare?: string;
  importer?: string;
  countryOfOrigin?: string;
}

export interface ProductDoc {
  _id: ObjectId;
  slug: string;
  name: string;
  brandId: ObjectId;
  categoryId: ObjectId;
  kind: "food" | "nonfood";
  description: string;
  images: string[];
  labelImages: string[];
  status: "draft" | "active" | "discontinued";
  featured: boolean;
  bestseller: boolean;
  tags: string[];
  attributes: { label: string; value: string }[];
  food?: FoodInfo;
  nonFood?: NonFoodInfo;
  seo?: Seo;
  /** lowercase name + brand + category + tags, for search */
  searchText: string;
  isDemo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Sellable on-hand = available + reserved. Units leave the shelf at dispatch commit. */
export interface VariantDoc {
  _id: ObjectId;
  productId: ObjectId;
  sku: string;
  label: string;
  /** net quantity, for the legally required unit sale price */
  netQty?: number;
  netUnit?: "g" | "kg" | "ml" | "l" | "pc";
  mrpPaise: number;
  pricePaise: number;
  available: number;
  reserved: number;
  lowStockThreshold: number;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type BatchStatus = "sellable" | "damaged" | "expired" | "returned" | "disposed";

export interface StockBatchDoc {
  _id: ObjectId;
  variantId: ObjectId;
  batchNo: string;
  expiryDate?: Date;
  qty: number;
  status: BatchStatus;
  receivedAt: Date;
  note?: string;
}

export type MovementType =
  | "receive"
  | "adjust"
  | "reserve"
  | "release"
  | "allocate"
  | "deduct"
  | "damage"
  | "expire"
  | "return"
  | "restock"
  | "dispose";

export interface MovementDoc {
  _id?: ObjectId;
  variantId: ObjectId;
  type: MovementType;
  qty: number;
  reason?: string;
  orderId?: ObjectId;
  batchId?: ObjectId;
  by?: string;
  at: Date;
}

export interface AddressFields {
  name: string;
  phone: string;
  flat: string;
  building: string;
  street: string;
  landmark?: string;
  pincode: string;
  city: string;
  lat?: number;
  lng?: number;
  instructions?: string;
}

export interface AddressDoc extends AddressFields {
  _id: ObjectId;
  userId: string;
  label: string;
  isDefault: boolean;
  createdAt: Date;
}

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packing"
  | "ready_for_dispatch"
  | "out_for_delivery"
  | "delivered"
  | "delivery_failed"
  | "rescheduled"
  | "cancelled";

export type PaymentStatus =
  | "awaiting_payment"
  | "verification_pending"
  | "paid"
  | "cod_due"
  | "collection_recorded"
  | "refund_pending"
  | "partially_refunded"
  | "refunded"
  | "void";

/** reserved: held with a deadline; allocated: held for a confirmed order; deducted: left the shelf */
export type StockState = "reserved" | "allocated" | "released" | "deducted";

export interface OrderItem {
  productId: ObjectId;
  variantId: ObjectId;
  name: string;
  brand: string;
  variantLabel: string;
  image?: string;
  mrpPaise: number;
  unitPricePaise: number;
  qty: number;
  lineTotalPaise: number;
  discountPaise: number;
  batches?: { batchNo: string; expiryDate?: Date; qty: number }[];
}

export interface Pricing {
  subtotalPaise: number;
  discountPaise: number;
  discountedSubtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  couponCode?: string;
  couponId?: ObjectId;
}

export interface TimelineEntry {
  at: Date;
  event: string;
  by?: string;
  note?: string;
}

export interface OrderDoc {
  _id: ObjectId;
  number: string;
  userId: string;
  idempotencyKey: string;
  items: OrderItem[];
  pricing: Pricing;
  address: AddressFields;
  paymentMethod: "upi" | "cod";
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  stock: StockState;
  reservationExpiresAt?: Date | null;
  paymentDeadline?: Date | null;
  upi?: { reference?: string; proofFileId?: ObjectId; submittedAt?: Date; clarification?: string };
  amountReceivedPaise: number;
  refundedPaise: number;
  refundPendingPaise: number;
  cod?: {
    collectedPaise: number;
    method: "cash" | "upi";
    reference?: string;
    recordedBy: string;
    recordedAt: Date;
    reconciledBy?: string;
    reconciledAt?: Date;
  };
  delivery: {
    batchId?: ObjectId;
    partnerId?: string;
    attempts: { at: Date; reason: string; note?: string; by: string }[];
    deliveredAt?: Date;
    deliveredBy?: string;
    note?: string;
    rescheduledFor?: Date;
  };
  substitution?: {
    status: "pending" | "approved" | "rejected";
    items: OrderItem[];
    pricing: Pricing;
    note?: string;
    proposedBy: string;
    proposedAt: Date;
    decidedAt?: Date;
  };
  confirmedAt?: Date;
  expectedBy?: Date;
  exception?: string | null;
  customerNote?: string;
  adminNotes: { at: Date; by: string; text: string }[];
  cancelReason?: string;
  cancelledBy?: "customer" | "admin" | "system";
  timeline: TimelineEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentEventType =
  | "upi_reference_submitted"
  | "upi_verified"
  | "clarification_requested"
  | "cod_collected"
  | "cod_reconciled"
  | "refund_initiated"
  | "refund_completed"
  | "payment_voided";

/** Append-only financial ledger. Never updated in place. */
export interface PaymentEventDoc {
  _id?: ObjectId;
  orderId: ObjectId;
  orderNumber: string;
  type: PaymentEventType;
  amountPaise: number;
  method?: "upi" | "cash";
  reference?: string;
  note?: string;
  by: string;
  byRole: Role | "system";
  at: Date;
}

export interface CouponDoc {
  _id: ObjectId;
  code: string;
  description?: string;
  type: "fixed" | "percent";
  /** paise for fixed, whole percent (1-100) for percent */
  value: number;
  minSubtotalPaise: number;
  maxDiscountPaise?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  usedCount: number;
  eligibleProductIds: ObjectId[];
  eligibleCategoryIds: ObjectId[];
  eligibleBrandIds: ObjectId[];
  firstOrderOnly: boolean;
  showOnStorefront: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryBatchDoc {
  _id: ObjectId;
  code: string;
  partnerId: string;
  partnerName: string;
  partnerPhone: string;
  partnerType: "permanent" | "temporary";
  orderIds: ObjectId[];
  status: "assigned" | "in_progress" | "completed" | "revoked";
  accessExpiresAt?: Date;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface DeliveryInviteDoc {
  _id: ObjectId;
  tokenHash: string;
  batchId: ObjectId;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

export interface SupportRequestDoc {
  _id: ObjectId;
  ticket: string;
  userId: string;
  orderId?: ObjectId;
  orderNumber?: string;
  topic: "cancellation" | "wrong_item" | "damaged" | "expired" | "missing" | "payment" | "account_deletion" | "other";
  message: string;
  status: "open" | "resolved";
  acknowledgedAt?: Date;
  resolution?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface AuditDoc {
  _id?: ObjectId;
  at: Date;
  actorId: string;
  actorRole: Role | "system";
  action: string;
  entity: string;
  entityId?: string;
  summary?: string;
  before?: unknown;
  after?: unknown;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  href?: string;
  active: boolean;
}

export interface Collection {
  id: string;
  title: string;
  subtitle?: string;
  tag: string;
  active: boolean;
}

export interface StorefrontContent {
  banners: Banner[];
  collections: Collection[];
  announcement?: string;
}

export interface ContentDoc<T> {
  _id: string;
  draft: T;
  published: T | null;
  publishedAt?: Date;
  publishedBy?: string;
  updatedAt: Date;
}

export interface PolicyContent {
  title: string;
  body: string;
  seoDescription?: string;
}

export interface RedirectDoc {
  _id?: ObjectId;
  from: string;
  to: string;
  createdAt: Date;
}

export interface PriceHistoryDoc {
  _id?: ObjectId;
  variantId: ObjectId;
  pricePaise: number;
  at: Date;
}
