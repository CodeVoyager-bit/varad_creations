# Varad Creation — online store

Customer storefront, admin portal and delivery-partner app for Varad Creation (Sadhana Society, Hadapsar, Pune): branded packaged Indori namkeen, snacks, bakery items and pickles, delivered across Pune and PCMC.

- **Stack:** Next.js 16 (App Router, Cache Components, TypeScript), Tailwind CSS 4, MongoDB (native driver, transactions), Better Auth (phone + password, TOTP for admins), MiniMoth OTP, Vercel Blob, Vercel Cron.
- **Docs:** [Deployment & operations](docs/DEPLOYMENT.md) · [Compliance notes & launch checklist](docs/COMPLIANCE.md)

## Run it locally

Requires Node 20+ and a MongoDB **replica set** (transactions). A local single-node one:

```bash
npm install
cp .env.example .env.local      # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:dev                  # first run only, in another terminal: initiate the replica set (see below)
npm run seed:demo               # demo catalog — clearly marked "Sample"
ADMIN_PASSWORD='choose-a-long-one' npm run admin:create -- --name "Owner" --phone 98XXXXXXXX
npm run dev
```

First-time replica-set initiation for `npm run db:dev`:

```bash
node -e 'new (require("mongodb").MongoClient)("mongodb://127.0.0.1:27018/?directConnection=true").db("admin").command({replSetInitiate:{_id:"rs0",members:[{_id:0,host:"127.0.0.1:27018"}]}}).then(console.log).finally(()=>process.exit())'
```

Without `MINIMOTH_API_KEY`, one-time codes are printed in the dev server log (`[dev OTP] +91… → 123456`). Without `BLOB_READ_WRITE_TOKEN`, uploads go to `public/uploads`. In development the dev UPI ID is `demo-do-not-pay@invalid`.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest: pricing thresholds, coupons, state machines, and DB-backed flows (needs the local replica set; uses database `varad_test`) |
| `npm run lint` | ESLint |
| `npm run seed:demo [-- --reset]` | Demo data (refuses to run in production) |
| `npm run admin:create -- --name … --phone …` | Bootstrap an admin (password from `ADMIN_PASSWORD` or prompt) |
| `npm run db:indexes` | Create/verify MongoDB indexes |

## Where things live

```
src/app/(shop)      storefront: home, catalog (/products, /c/[slug], /b/[slug], /p/[slug]), search,
                    cart, checkout, orders, account, auth pages, policy pages
src/app/admin       admin portal (every page and action calls requireAdmin)
src/app/delivery    delivery-partner app + /delivery/join (temporary invite links)
src/app/actions     server actions (thin: auth check → service → cache revalidation)
src/app/api         Better Auth handler, private payment-file route, maintenance cron
src/server          business logic: orders, payments, inventory, delivery, coupons/catalog admin, storage, OTP, geo
src/lib             db, auth, pricing (pure), order state machines (pure), types, policy drafts/renderer
tests               vitest suites (pure + MongoDB integration)
scripts             seed, admin bootstrap, indexes
```

## Business rules (as implemented)

**Pricing** (`src/lib/pricing.ts`, integer paise, recomputed on the server at quote and checkout):
1. Subtotal = Σ server selling price × qty. 2. One coupon: active, date window, total + per-customer usage, first-order, eligible items, minimum checked on *eligible* items. 3. Discount = fixed or ⌊eligible × %⌋, capped by max discount, never above the eligible amount. 4. Discounted subtotal = subtotal − discount. 5. Delivery ₹50 if discounted subtotal < ₹600, else free. 6. Total = discounted subtotal + delivery. No other fees. The client sends the total it showed; any mismatch rejects the order so the customer re-reviews.

**Orders:** `placed → confirmed → packing → ready_for_dispatch → out_for_delivery → delivered`, plus `cancelled`, `delivery_failed → rescheduled`. Every transition is a conditional update on the current status (no double-apply). Customers can cancel only before packing. Substitutions are proposals the customer must approve. Orders snapshot items, prices, discounts, fee and address.

**Payments** are a separate machine: `awaiting_payment → verification_pending → paid`, `cod_due → collection_recorded → paid (reconciled)`, `refund_pending → refunded / partially_refunded`, `void`. A UTR or screenshot from the customer never marks an order paid; an admin confirms after seeing the money, and the ledger (`payment_events`, append-only) records who and when. COD collection by the partner and settlement with the shop are separate events.

**Stock** per pack size: `available` (sellable now) + `reserved` (held for open orders) = Σ sellable batches. Checkout reserves atomically inside a transaction (no overselling). Holds: unpaid UPI = payment window (30 min); after a UTR is submitted = 12 h; COD awaiting acceptance = 24 h (all configurable). Expired holds are released by the cron **and** at request time (quote, checkout, order page, admin dashboard); an unpaid UPI order with no UTR is cancelled. Confirming an order whose hold lapsed re-reserves; if stock is gone the order is flagged for admin (substitute or refund). Stock leaves the shelf once, at "ready for dispatch", earliest-expiry batch first. Returns land in a separate "returned" bucket and are never automatically resellable; expired batches are segregated daily.

**Delivery partners:** permanent partners sign in normally. Temporary partners get a single-use, 2-hour invite link (token hashed at rest, carried in the URL fragment) that creates a Better Auth session limited to one batch; access ends when the batch completes, is revoked, or times out, and admin can reissue after re-verifying the partner.

## Verification status

`npm test` → 28 tests passing (₹599/₹600/coupon-adjusted thresholds, coupon caps/limits/concurrency, last-unit concurrency, duplicate submissions, reservation expiry + late UPI verification, refund transitions, COD collection vs reconciliation, customer/partner isolation, invite reuse/expiry, cancellation stock & coupon release, substitution approval, batch expiry, signed file links, policy HTML escaping). `npm run build` passes. See docs/DEPLOYMENT.md for what was checked manually and what remains.
