# Deployment & operations

## 1. Services to create

| Service | Why | Notes |
|---|---|---|
| **MongoDB Atlas** (Mumbai region, M10+ recommended; M0 works for trials) | All data; transactions for checkout/inventory | Create a DB user with readWrite on one database. Allow Vercel egress (Atlas → Network Access; or use the Vercel–Atlas integration). |
| **Vercel** project | Hosting, Cron, Blob | Region `bom1` is set in `vercel.json`. |
| **Vercel Blob** store | Product/brand/banner/logo images (public) | Connect the store to the project; it injects `BLOB_READ_WRITE_TOKEN`. Payment screenshots are **not** stored here — they go to MongoDB GridFS and are served only through `/api/files/[id]` with a 10-minute signed link plus an admin session. |
| **MiniMoth** project | OTP for registration and password reset | Use the `mm_live_` key in production. Codes go by WhatsApp first, SMS fallback (MiniMoth's sender name). MiniMoth's own session tokens are discarded; Better Auth is the only session authority. |
| Geocoder (optional) | "Use my location" address suggestion | Default is public OSM Nominatim (≤1 req/s, no autocomplete, attribution shown). For real volume set `GEOCODER_URL`/`GEOCODER_KEY` to a Nominatim-compatible provider (e.g. LocationIQ). |

## 2. Environment variables

See `.env.example`. Production must have `MONGODB_URI`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL` (the final https domain), `MINIMOTH_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`. Missing integrations fail safely: OTP sending refuses, uploads refuse, the cron endpoint returns 401 — Settings → Integrations shows the status. Set **different** values for Preview deployments (separate database recommended).

## 3. First deploy

1. Push to GitHub, import into Vercel, add env vars, deploy.
2. Create indexes and the owner account (from a machine with the production `MONGODB_URI` in `.env.local`, or temporarily exported):
   ```bash
   npm run db:indexes
   ADMIN_PASSWORD='a-long-unique-password' npm run admin:create -- --name "Owner Name" --phone 98XXXXXXXX
   ```
   Do **not** run `seed:demo` against production (it refuses when `NODE_ENV`/`VERCEL_ENV` is production).
3. Sign in at `/login`. You'll be sent to `/admin/security` to enrol an authenticator app (mandatory for admins in production). Store the backup codes.
4. Admin → **Settings**: legal name, FSSAI number, GSTIN (or leave blank if not registered), support email, hours, grievance officer, **UPI ID + payee name**, issue-report window and refund processing days, service-area pincodes (the starter list is unverified), logo. The dashboard's launch checklist disappears when everything is filled.
5. Admin → **Brands & categories**, **Products** (pack sizes, MRP, price, net quantity, label details copied from packs, photos), **Inventory** (receive stock with batch + expiry). Tupperware/non-food categories stay hidden until you tick "Visible".
6. Admin → **Policies & SEO**: review each draft with a lawyer/CA, save, publish.
7. Admin → **Storefront**: banner, collections; save draft → check preview → publish.
8. Add delivery partners (Delivery → Permanent partners). They set their password with "Forgot password" on the sign-in page.

## 4. Scheduled jobs

`vercel.json` runs `/api/cron/maintenance` daily (02:00 IST) — this works on every Vercel plan. It releases expired stock holds, segregates expired batches, deletes payment screenshots older than 180 days and re-checks indexes. Stock holds are also released at request time (cart quote, checkout, order pages, admin dashboard), so correctness doesn't depend on the cron. On a Pro plan you can change the schedule to `*/15 * * * *` for tidier reports.

## 5. Domain, SEO and Search Console

1. Add the domain in Vercel; set `NEXT_PUBLIC_SITE_URL=https://<domain>`; redeploy (canonical URLs, sitemap and Open Graph use it).
2. Preview deployments are `noindex` (robots.txt disallows all and an `X-Robots-Tag` header is added when `VERCEL_ENV` ≠ production).
3. Google Search Console → add a **Domain property** → verify via the DNS TXT record at your registrar → Sitemaps → submit `https://<domain>/sitemap.xml`.
4. Indexed: home, `/products`, `/categories`, `/brands`, `/c/*`, `/b/*`, active `/p/*`, policy pages. Excluded: admin, delivery, account, orders, cart, checkout, auth pages, search, API (robots + `noindex` headers; real protection is server-side auth). Discontinued products stay reachable with `noindex` and drop out of the sitemap. Renamed slugs leave permanent redirects. Unknown product/category/brand URLs return HTTP 404.
5. No ranking or indexing outcome is guaranteed.

## 6. Security notes

- Every admin/delivery/customer page and server action re-checks the session, role and ownership on the server. Proxy redirects are only a convenience.
- Admins: TOTP 2FA required (production), sessions expire after 12 h, all changes go to the audit log (prices, stock, payments, refunds, settings, content, deliveries, users, customer-record views, file views, CSV exports).
- Rate limits: Better Auth (sign-in, reset, TOTP, invite redemption — stored in MongoDB) plus app-level limits on registration OTPs (per IP and per number), checkout, UPI submissions, support requests, location lookups.
- Account enumeration: sign-in errors are generic; password-reset responses are identical whether or not the number exists; registration reveals an existing account only after the OTP proves ownership.
- Uploads: JPEG/PNG/WebP only, detected from file bytes, ≤5 MB; SVG rejected.
- Private responses send `Cache-Control: private, no-store`; the service worker caches only the offline page.
- Not implemented: a strict Content-Security-Policy with nonces (would force every page dynamic). Add one if you introduce third-party scripts.

## 7. Backups & recovery

- Atlas M10+: enable **Cloud Backup** with point-in-time restore (e.g. 7-day PITR + daily snapshots kept 30 days). M0 has no automated backups — export regularly with `mongodump --uri "$MONGODB_URI" --gzip --archive=varad-$(date +%F).gz` and keep copies off-site.
- Vercel Blob images: keep the originals you upload; Blob has no point-in-time restore.
- Restore drill (quarterly): restore a snapshot to a new cluster, point a Preview deployment's `MONGODB_URI` at it, sign in and open recent orders.
- Secrets: rotating `BETTER_AUTH_SECRET` signs everyone out and invalidates outstanding payment-file links.

## 8. Verified vs not verified

Verified in this repository: `npm test` (28 tests, including concurrency on a real replica set), `npm run build`, lint/type-check, and a manual browser run of register (dev OTP) → cart → checkout → admin payment verification → packing → ready → temporary-partner batch → invite link → delivery → batch completion and access revocation; HTTP status checks for 404s, redirects and cache headers on a production build.

Not verified (needs live credentials or real devices): MiniMoth delivery with a live key, Vercel Blob uploads, Vercel Cron invocation, UPI deep links on Android/iOS UPI apps, geolocation prompts on real phones, PWA install prompts, WebView wrapper behaviour.
