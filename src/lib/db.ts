import { MongoClient, type ClientSession, type Document } from "mongodb";
import type {
  AddressDoc,
  AuditDoc,
  BrandDoc,
  CategoryDoc,
  ContentDoc,
  CouponDoc,
  DeliveryBatchDoc,
  DeliveryInviteDoc,
  MovementDoc,
  OrderDoc,
  PaymentEventDoc,
  PriceHistoryDoc,
  ProductDoc,
  RedirectDoc,
  StockBatchDoc,
  SupportRequestDoc,
  VariantDoc,
} from "./types";
import type { SettingsDoc } from "./settings-defaults";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set. See .env.example.");

const g = globalThis as unknown as { _vcMongo?: MongoClient };
export const client = (g._vcMongo ??= new MongoClient(uri, { appName: "varad-creation", maxPoolSize: 10 }));
export const db = client.db();

export interface AuthUserDoc extends Document {
  _id: import("mongodb").ObjectId;
  name: string;
  email: string;
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean;
  role: "customer" | "admin" | "delivery";
  partnerType?: "permanent" | "temporary" | null;
  accessExpiresAt?: Date | null;
  activeBatchId?: string | null;
  disabled?: boolean;
  twoFactorEnabled?: boolean;
  createdAt: Date;
}

export const C = {
  users: db.collection<AuthUserDoc>("user"),
  sessions: db.collection("session"),
  settings: db.collection<SettingsDoc>("settings"),
  categories: db.collection<CategoryDoc>("categories"),
  brands: db.collection<BrandDoc>("brands"),
  products: db.collection<ProductDoc>("products"),
  variants: db.collection<VariantDoc>("variants"),
  batches: db.collection<StockBatchDoc>("stock_batches"),
  movements: db.collection<MovementDoc>("inventory_movements"),
  addresses: db.collection<AddressDoc>("addresses"),
  orders: db.collection<OrderDoc>("orders"),
  paymentEvents: db.collection<PaymentEventDoc>("payment_events"),
  coupons: db.collection<CouponDoc>("coupons"),
  couponRedemptions: db.collection<{
    couponId: import("mongodb").ObjectId;
    userId: string;
    orderId: import("mongodb").ObjectId;
    status: "active" | "released";
    createdAt: Date;
  }>("coupon_redemptions"),
  deliveryBatches: db.collection<DeliveryBatchDoc>("delivery_batches"),
  invites: db.collection<DeliveryInviteDoc>("delivery_invites"),
  support: db.collection<SupportRequestDoc>("support_requests"),
  audit: db.collection<AuditDoc>("audit_logs"),
  content: db.collection<ContentDoc<unknown>>("content"),
  redirects: db.collection<RedirectDoc>("redirects"),
  priceHistory: db.collection<PriceHistoryDoc>("price_history"),
  counters: db.collection<{ _id: string; seq: number }>("counters"),
  rateLimits: db.collection<{ _id: string; count: number; expiresAt: Date }>("rate_limits"),
  geoCache: db.collection<{ _id: string; result: unknown; expiresAt: Date }>("geo_cache"),
  alerts: db.collection<{ _id?: import("mongodb").ObjectId; kind: string; message: string; ref?: string; resolved: boolean; at: Date }>("alerts"),
};

/** Runs fn in a multi-document transaction (needs a replica set; Atlas qualifies). */
export async function withTxn<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = client.startSession();
  try {
    let out!: T;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } finally {
    await session.endSession();
  }
}

export async function nextSeq(name: string, session?: ClientSession) {
  const r = await C.counters.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  );
  return r!.seq;
}

/** Idempotent; run by the seed/bootstrap scripts and the maintenance cron. */
export async function ensureIndexes() {
  await Promise.all([
    C.users.createIndex({ phoneNumber: 1 }, { unique: true, sparse: true }),
    C.categories.createIndex({ slug: 1 }, { unique: true }),
    C.brands.createIndex({ slug: 1 }, { unique: true }),
    C.products.createIndex({ slug: 1 }, { unique: true }),
    C.products.createIndex({ status: 1, categoryId: 1 }),
    C.products.createIndex({ status: 1, brandId: 1 }),
    C.variants.createIndex({ productId: 1 }),
    C.variants.createIndex({ sku: 1 }, { unique: true }),
    C.batches.createIndex({ variantId: 1, status: 1, expiryDate: 1 }),
    C.batches.createIndex({ status: 1, expiryDate: 1 }),
    C.movements.createIndex({ variantId: 1, at: -1 }),
    C.movements.createIndex({ at: -1 }),
    C.addresses.createIndex({ userId: 1 }),
    C.orders.createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true }),
    C.orders.createIndex({ number: 1 }, { unique: true }),
    C.orders.createIndex({ userId: 1, createdAt: -1 }),
    C.orders.createIndex({ status: 1, createdAt: -1 }),
    C.orders.createIndex({ paymentStatus: 1 }),
    C.orders.createIndex({ stock: 1, reservationExpiresAt: 1 }),
    C.orders.createIndex({ "delivery.batchId": 1 }),
    C.paymentEvents.createIndex({ orderId: 1, at: 1 }),
    C.paymentEvents.createIndex({ at: -1 }),
    C.coupons.createIndex({ code: 1 }, { unique: true }),
    C.couponRedemptions.createIndex({ couponId: 1, userId: 1, status: 1 }),
    C.couponRedemptions.createIndex({ orderId: 1 }),
    C.deliveryBatches.createIndex({ partnerId: 1, status: 1 }),
    C.invites.createIndex({ tokenHash: 1 }, { unique: true }),
    C.support.createIndex({ status: 1, createdAt: -1 }),
    C.support.createIndex({ userId: 1 }),
    C.audit.createIndex({ at: -1 }),
    C.audit.createIndex({ entity: 1, entityId: 1 }),
    C.redirects.createIndex({ from: 1 }, { unique: true }),
    C.priceHistory.createIndex({ variantId: 1, at: -1 }),
    C.support.createIndex({ ticket: 1 }, { unique: true }),
    C.rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    C.geoCache.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    C.alerts.createIndex({ resolved: 1, at: -1 }),
  ]);
}

/** Server -> client boundary: ObjectIds become hex strings, Dates become ISO strings. */
export function plain<T>(x: T): Jsonify<T> {
  return JSON.parse(JSON.stringify(x));
}

export type Jsonify<T> = T extends Date
  ? string
  : T extends import("mongodb").ObjectId
    ? string
    : T extends (infer U)[]
      ? Jsonify<U>[]
      : T extends object
        ? { [K in keyof T]: Jsonify<T[K]> }
        : T;
