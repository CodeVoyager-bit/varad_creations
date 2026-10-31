import { describe, expect, it } from "vitest";
import { evaluateCoupon, priceCart, type CouponRule, type QuoteLine } from "@/lib/pricing";
import { canMoveOrder, canMovePayment } from "@/lib/order-rules";
import { toPaise } from "@/lib/money";

const rule = { feePaise: 5000, freeAbovePaise: 60000 };
const line = (pricePaise: number, qty = 1, over: Partial<QuoteLine> = {}): QuoteLine => ({
  variantId: "v" + pricePaise,
  productId: "p1",
  categoryId: "c1",
  brandId: "b1",
  unitPricePaise: pricePaise,
  qty,
  ...over,
});
const coupon = (over: Partial<CouponRule> = {}): CouponRule => ({
  code: "SAVE",
  type: "fixed",
  value: 10000,
  minSubtotalPaise: 0,
  usedCount: 0,
  eligibleProductIds: [],
  eligibleCategoryIds: [],
  eligibleBrandIds: [],
  firstOrderOnly: false,
  active: true,
  ...over,
});
const ctx = { now: new Date("2026-06-01"), signedIn: true, priorOrders: 0, customerUses: 0 };

describe("delivery threshold", () => {
  it("₹599 pays ₹50 delivery", () => {
    const q = priceCart([line(59900)], rule);
    expect(q.deliveryFeePaise).toBe(5000);
    expect(q.totalPaise).toBe(64900);
    expect(q.freeDeliveryRemainingPaise).toBe(100);
  });
  it("₹600 is free", () => {
    const q = priceCart([line(60000)], rule);
    expect(q.deliveryFeePaise).toBe(0);
    expect(q.totalPaise).toBe(60000);
  });
  it("threshold applies after coupon: ₹650 − ₹100 = ₹550 + ₹50 = ₹600", () => {
    const lines = [line(65000)];
    const q = priceCart(lines, rule, evaluateCoupon(lines, coupon(), ctx));
    expect(q.discountedSubtotalPaise).toBe(55000);
    expect(q.deliveryFeePaise).toBe(5000);
    expect(q.totalPaise).toBe(60000);
  });
  it("empty cart has no delivery fee", () => {
    expect(priceCart([], rule).totalPaise).toBe(0);
  });
});

describe("coupons", () => {
  it("percent is capped by maxDiscount", () => {
    const lines = [line(100000)];
    const r = evaluateCoupon(lines, coupon({ type: "percent", value: 20, maxDiscountPaise: 15000 }), ctx);
    expect(r.ok && r.discountPaise).toBe(15000);
  });
  it("discount never exceeds the eligible subtotal", () => {
    const lines = [line(3000)];
    const q = priceCart(lines, rule, evaluateCoupon(lines, coupon({ value: 50000 }), ctx));
    expect(q.discountPaise).toBe(3000);
    expect(q.discountedSubtotalPaise).toBe(0);
    expect(q.totalPaise).toBe(5000);
  });
  it("minimum is checked on eligible items only", () => {
    const lines = [line(40000, 1, { brandId: "b1" }), line(30000, 1, { brandId: "b2", variantId: "x" })];
    const r = evaluateCoupon(lines, coupon({ eligibleBrandIds: ["b1"], minSubtotalPaise: 50000 }), ctx);
    expect(r.ok).toBe(false);
  });
  it("splits the discount across eligible lines exactly", () => {
    const lines = [line(33333), line(33333, 1, { variantId: "y" }), line(33334, 1, { variantId: "z", brandId: "b9" })];
    const r = evaluateCoupon(lines, coupon({ type: "percent", value: 10, eligibleBrandIds: ["b1"] }), ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.perLine.reduce((a, b) => a + b, 0)).toBe(r.discountPaise);
      expect(r.perLine[2]).toBe(0);
    }
  });
  it("usage limits, first order, dates and sign-in", () => {
    const l = [line(70000)];
    expect(evaluateCoupon(l, coupon({ usageLimit: 5, usedCount: 5 }), ctx).ok).toBe(false);
    expect(evaluateCoupon(l, coupon({ perCustomerLimit: 1 }), { ...ctx, customerUses: 1 }).ok).toBe(false);
    expect(evaluateCoupon(l, coupon({ firstOrderOnly: true }), { ...ctx, priorOrders: 1 }).ok).toBe(false);
    expect(evaluateCoupon(l, coupon({ firstOrderOnly: true }), { ...ctx, signedIn: false }).ok).toBe(false);
    expect(evaluateCoupon(l, coupon({ endsAt: new Date("2026-05-01") }), ctx).ok).toBe(false);
    expect(evaluateCoupon(l, coupon({ startsAt: new Date("2026-07-01") }), ctx).ok).toBe(false);
    expect(evaluateCoupon(l, coupon({ active: false }), ctx).ok).toBe(false);
    expect(evaluateCoupon(l, coupon({ firstOrderOnly: true }), ctx).ok).toBe(true);
  });
});

describe("state machines", () => {
  it("fulfilment transitions", () => {
    expect(canMoveOrder("placed", "confirmed")).toBe(true);
    expect(canMoveOrder("placed", "packing")).toBe(false);
    expect(canMoveOrder("delivered", "cancelled")).toBe(false);
    expect(canMoveOrder("out_for_delivery", "cancelled")).toBe(false);
    expect(canMoveOrder("delivery_failed", "rescheduled")).toBe(true);
  });
  it("payment transitions", () => {
    expect(canMovePayment("awaiting_payment", "verification_pending")).toBe(true);
    expect(canMovePayment("verification_pending", "paid")).toBe(true);
    expect(canMovePayment("cod_due", "paid")).toBe(false);
    expect(canMovePayment("refunded", "refund_pending")).toBe(false);
    expect(canMovePayment("paid", "refund_pending")).toBe(true);
  });
});

describe("money parsing", () => {
  it("parses rupees to paise without float error", () => {
    expect(toPaise("85.5")).toBe(8550);
    expect(toPaise("0.29")).toBe(29);
    expect(() => toPaise("-1")).toThrow();
    expect(() => toPaise("1.234")).toThrow();
  });
});
