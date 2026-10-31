/**
 * Cart pricing. Pure functions, integer paise, shared by the cart quote and checkout.
 *
 * Calculation order:
 *  1. subtotal = Σ server selling price × qty
 *  2. coupon checks: active, date window, total + per-customer usage, first order,
 *     at least one eligible line, eligible subtotal ≥ minimum
 *  3. discount = fixed value | floor(eligible subtotal × percent / 100),
 *     then capped by maxDiscount, then capped by the eligible subtotal (never negative)
 *  4. discount is split across eligible lines (for refunds and order snapshots)
 *  5. discounted subtotal = subtotal − discount
 *  6. delivery fee = fee if discounted subtotal < free-delivery threshold, else 0
 *  7. total = discounted subtotal + delivery fee   (no other fees)
 */

export interface QuoteLine {
  variantId: string;
  productId: string;
  categoryId: string;
  brandId: string;
  unitPricePaise: number;
  qty: number;
}

export interface CouponRule {
  code: string;
  type: "fixed" | "percent";
  value: number;
  minSubtotalPaise: number;
  maxDiscountPaise?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  usageLimit?: number | null;
  usedCount: number;
  perCustomerLimit?: number | null;
  eligibleProductIds: string[];
  eligibleCategoryIds: string[];
  eligibleBrandIds: string[];
  firstOrderOnly: boolean;
  active: boolean;
}

export interface CouponContext {
  now: Date;
  signedIn: boolean;
  /** non-cancelled orders already placed by this customer */
  priorOrders: number;
  /** active redemptions of this coupon by this customer */
  customerUses: number;
}

export interface DeliveryRule {
  feePaise: number;
  freeAbovePaise: number;
}

export type CouponResult =
  | { ok: true; code: string; discountPaise: number; perLine: number[] }
  | { ok: false; code: string; reason: string };

export interface Quote {
  subtotalPaise: number;
  discountPaise: number;
  discountedSubtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  lineDiscounts: number[];
  freeDeliveryRemainingPaise: number;
  coupon?: CouponResult;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function isEligible(line: QuoteLine, c: CouponRule) {
  const any = c.eligibleProductIds.length + c.eligibleCategoryIds.length + c.eligibleBrandIds.length;
  if (!any) return true;
  return (
    c.eligibleProductIds.includes(line.productId) ||
    c.eligibleCategoryIds.includes(line.categoryId) ||
    c.eligibleBrandIds.includes(line.brandId)
  );
}

export function evaluateCoupon(lines: QuoteLine[], c: CouponRule, ctx: CouponContext): CouponResult {
  const fail = (reason: string): CouponResult => ({ ok: false, code: c.code, reason });
  if (!c.active) return fail("This coupon is not active.");
  if (c.startsAt && ctx.now < c.startsAt) return fail("This coupon is not active yet.");
  if (c.endsAt && ctx.now > c.endsAt) return fail("This coupon has expired.");
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return fail("This coupon has reached its usage limit.");
  if ((c.firstOrderOnly || c.perCustomerLimit != null) && !ctx.signedIn) return fail("Sign in to use this coupon.");
  if (c.firstOrderOnly && ctx.priorOrders > 0) return fail("This coupon is only for your first order.");
  if (c.perCustomerLimit != null && ctx.customerUses >= c.perCustomerLimit)
    return fail("You have already used this coupon the maximum number of times.");

  const eligible = lines.map((l) => isEligible(l, c));
  const lineTotals = lines.map((l) => l.unitPricePaise * l.qty);
  const eligibleSubtotal = sum(lineTotals.filter((_, i) => eligible[i]));
  if (eligibleSubtotal === 0) return fail("None of the items in your cart are eligible for this coupon.");
  if (eligibleSubtotal < c.minSubtotalPaise)
    return fail(`Add eligible items worth ₹${Math.ceil((c.minSubtotalPaise - eligibleSubtotal) / 100)} more to use this coupon.`);

  let discount = c.type === "fixed" ? c.value : Math.floor((eligibleSubtotal * c.value) / 100);
  if (c.maxDiscountPaise != null) discount = Math.min(discount, c.maxDiscountPaise);
  discount = Math.max(0, Math.min(discount, eligibleSubtotal));

  // split proportionally over eligible lines; leftover paise go to the largest lines
  const perLine = lineTotals.map((t, i) => (eligible[i] ? Math.floor((discount * t) / eligibleSubtotal) : 0));
  let left = discount - sum(perLine);
  const order = lineTotals.map((t, i) => i).filter((i) => eligible[i]).sort((a, b) => lineTotals[b] - lineTotals[a]);
  for (let k = 0; left > 0; k = (k + 1) % order.length) {
    const i = order[k];
    if (perLine[i] < lineTotals[i]) {
      perLine[i]++;
      left--;
    }
  }
  return { ok: true, code: c.code, discountPaise: discount, perLine };
}

export function priceCart(lines: QuoteLine[], rule: DeliveryRule, coupon?: CouponResult): Quote {
  const subtotal = sum(lines.map((l) => l.unitPricePaise * l.qty));
  const discount = coupon?.ok ? coupon.discountPaise : 0;
  const discounted = subtotal - discount;
  const deliveryFee = lines.length === 0 || discounted >= rule.freeAbovePaise ? 0 : rule.feePaise;
  return {
    subtotalPaise: subtotal,
    discountPaise: discount,
    discountedSubtotalPaise: discounted,
    deliveryFeePaise: deliveryFee,
    totalPaise: discounted + deliveryFee,
    lineDiscounts: coupon?.ok ? coupon.perLine : lines.map(() => 0),
    freeDeliveryRemainingPaise: Math.max(0, rule.freeAbovePaise - discounted),
    coupon,
  };
}
