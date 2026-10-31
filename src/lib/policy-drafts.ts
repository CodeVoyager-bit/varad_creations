import type { PolicyContent } from "./types";

/**
 * Starting drafts, written for this business from the compliance review in docs/COMPLIANCE.md.
 * {{placeholders}} pull live values from admin settings; anything not yet set shows a visible
 * "to be added" marker. Have a lawyer/CA review before launch. Not legal advice.
 */
export const POLICY_PAGES: { slug: string; path: string; label: string }[] = [
  { slug: "about", path: "/about", label: "About us" },
  { slug: "contact", path: "/contact", label: "Contact us" },
  { slug: "terms", path: "/terms", label: "Terms & conditions" },
  { slug: "privacy", path: "/privacy-policy", label: "Privacy policy" },
  { slug: "shipping", path: "/shipping-policy", label: "Shipping & delivery policy" },
  { slug: "refunds", path: "/cancellation-refund-policy", label: "Cancellation, returns & refunds" },
  { slug: "payments", path: "/payment-information", label: "Payment information" },
  { slug: "grievance", path: "/grievance-redressal", label: "Grievance redressal" },
  { slug: "faq", path: "/faq", label: "FAQ" },
];

const contactBlock = `- Phone / WhatsApp: {{phone}}
- Email: {{email}}
- Shop: {{address}}
- Hours: {{hours}}`;

export const POLICY_DRAFTS: Record<string, PolicyContent> = {
  about: {
    title: "About us",
    seoDescription: "Varad Creation is a shop in Hadapsar, Pune selling branded packaged Indori namkeen, snacks, bakery items and pickles, delivered across Pune and PCMC.",
    body: `{{businessName}} is a shop at {{address}}. We sell branded, sealed packaged food — Indori namkeen, snacks, bakery items, pickles and more — from brands such as Agrawal 420, Mahendra, Pushp, Chheda's, Aathavlez, Gangwal and Jai Jalaram.

## What we do
- We sell packaged products only — never loose or repacked items.
- We deliver across {{areas}} with our own delivery team and delivery partners we assign, within {{windowHours}} hours of confirming your order.
- You can pay by UPI or cash on delivery.

## Who we are
Legal name: {{legalName}}
FSSAI registration / licence no.: {{fssai}}
GSTIN: {{gstin}}

## Talk to us
${contactBlock}`,
  },
  contact: {
    title: "Contact us",
    seoDescription: "Contact Varad Creation, Hadapsar, Pune — phone, WhatsApp, email and shop address.",
    body: `We're happy to help with orders, delivery, payments and product questions.

${contactBlock}
- Instagram: {{instagram}}

For complaints about an order, use **Need help with this order?** on the order page so you get a request number, or see [Grievance redressal](/grievance-redressal).`,
  },
  terms: {
    title: "Terms & conditions",
    seoDescription: "Terms for buying from Varad Creation online.",
    body: `These terms apply when you buy from {{businessName}} ({{legalName}}, {{address}}) through {{siteUrl}}. By placing an order you agree to them.

## Who can buy
- You must be 18 or older, or order with the involvement of a parent or guardian.
- We deliver only to the serviceable pincodes in {{areas}} shown at checkout.

## Your account
- You sign in with your mobile number and password. We verify the number with a one-time code when you register or reset your password.
- Keep your password private. Tell us immediately if you think someone else has used your account.

## Products and prices
- We sell branded, pre-packaged products. Product information on the site is copied from the pack label; the label on the pack you receive is the final reference.
- Prices are in Indian rupees and include all taxes (MRP-inclusive). We never charge more than the MRP printed on the pack.
- The delivery fee is {{deliveryFee}} when your order total after discounts is below {{freeAbove}}, and free at or above it. There are no other fees — no handling, packing, platform or cash-on-delivery fees.
- The total you see at checkout, with its breakdown, is the amount you pay.

## Orders
- Placing an order is an offer to buy. A contract is formed when we confirm your order.
- UPI orders are confirmed after we verify the payment in our account. Cash-on-delivery orders are confirmed by the shop after you place them.
- If an item becomes unavailable after you order, we will ask for your approval before making any substitution. If you don't approve, we will cancel that item or the order and refund any amount paid for it.

## Coupons
- One coupon per order. Each coupon's conditions (minimum value, eligible products, dates, usage limits) are shown when you apply it. Coupons have no cash value.

## Cancellations, returns and refunds
See our [Cancellation, returns & refunds policy](/cancellation-refund-policy).

## Our responsibility
Nothing in these terms limits your rights under the Consumer Protection Act, 2019 or other applicable law.

## Disputes
These terms are governed by the laws of India. Please contact us first — see [Grievance redressal](/grievance-redressal). You may also approach the National Consumer Helpline (1915 / consumerhelpline.gov.in) or the consumer commission with jurisdiction.

## Changes
We may update these terms. The version published on this page when you place an order applies to that order.`,
  },
  privacy: {
    title: "Privacy policy",
    seoDescription: "How Varad Creation collects, uses, shares and protects your personal data.",
    body: `This policy explains how {{businessName}} ({{legalName}}, {{address}}) handles your personal data when you use {{siteUrl}}.

## What we collect and why
- **Name and mobile number** — to create your account, let you sign in, and contact you about your orders.
- **One-time codes** — sent to your mobile number only to verify it when you register or reset your password.
- **Delivery addresses** (recipient name, phone, flat, building, street, landmark, pincode, city, optional instructions) — to deliver your orders and check that we deliver to your area.
- **Device location (optional)** — only if you tap “Use my location”. Your browser asks for permission first. We use the coordinates to suggest your address and check delivery coverage, and store them with that address only if you save it. You can remove the pin at any time.
- **Orders** — items, prices, discounts, delivery fee, status and history, to fulfil orders, handle returns and refunds, and keep the records the law requires.
- **Payment details** — your UPI transaction reference and, only if you choose to upload it, a payment screenshot, so we can match your payment. We never see or store your UPI PIN, bank account number or card details.
- **Delivery records** — who delivered, when, failed-attempt reasons and how a cash-on-delivery amount was collected.
- **Support messages** — what you tell us when you raise a request.
- **Security logs** — IP address and basic request information, to prevent abuse (for example, limiting repeated sign-in or code requests).

We don't send marketing messages, and we don't sell your personal data.

## Who we share it with
- **Delivery partners** — our staff or delivery partners we assign see only what they need for the deliveries currently assigned to them: your name, phone number, delivery address, items and the amount to collect. Temporary partners' access ends when their delivery batch is completed, revoked or timed out.
- **Service providers** who process data for us: website hosting, database and file storage; the one-time-code delivery service (receives your mobile number to send the code by WhatsApp or SMS); and an address-lookup service (receives coordinates only, when you use “Use my location”; address data © OpenStreetMap contributors).
- **Authorities**, when the law requires it.

## Cookies and device storage
We use only what the site needs to work: a sign-in cookie, and your device's local storage for your cart and delivery pincode. No advertising or tracking cookies.

## How long we keep data
- Your account and saved addresses: until you ask us to delete your account.
- Order, payment, refund and delivery records: for at least one year, and longer where tax, accounting or consumer law requires.
- Payment screenshots: deleted automatically 180 days after upload.
- Security logs and rate-limit counters: short periods (minutes to days).

## Your choices and rights
You can view and update your name and addresses in **My account**, and ask us to access, correct or delete your personal data, or to stop processing it, using **Help & privacy requests** in your account or the contacts below. We will respond within the time the law requires. When we delete your account we may keep the records we are legally required to keep. You can also ask us how your data has been shared. Where the Digital Personal Data Protection Act, 2023 applies, you may complain to the Data Protection Board of India after contacting us.

## Security
Passwords are stored only as secure hashes. Access to admin and delivery tools is restricted by role, payment screenshots are private and viewable only by the shop through short-lived links, and admin actions are logged.

## Children
If you are under 18, please use the site with a parent or guardian.

## Grievance officer
- Name: {{grievanceName}} ({{grievanceDesignation}})
- Phone: {{grievancePhone}}
- Email: {{grievanceEmail}}

We acknowledge complaints within 48 hours and aim to resolve them within one month.

## Changes
We will post any change to this policy on this page with the date it takes effect.`,
  },
  shipping: {
    title: "Shipping & delivery policy",
    seoDescription: "Delivery areas, times and charges for Varad Creation orders in Pune and PCMC.",
    body: `## Where we deliver
We deliver to the serviceable pincodes in {{areas}}. Enter your pincode on the site or at checkout to check. We check the pincode, and the pinned location if you share one, against our delivery area.

## When
- We deliver within {{windowHours}} hours of **confirming** your order.
- Cash-on-delivery orders: the window starts when the shop accepts your order.
- UPI orders: the window starts when we have verified your payment and accepted the order.
- Your order page shows the expected delivery time once your order is confirmed.

## Charges
- {{deliveryFee}} when your order total after coupon discounts is below {{freeAbove}}.
- Free when it is {{freeAbove}} or more.
- No other fees.

## Who delivers
Orders are delivered by {{businessName}}'s delivery team — our own staff or delivery partners we assign. They will call you if they can't find the address.

## If we can't deliver
If a delivery attempt is unsuccessful (for example, no one is available or the address can't be found), we will contact you to arrange a new time. If we can't reach you, we may cancel the order and refund any amount you paid.

## Late deliveries
If we miss the delivery window for reasons within our control, contact us — you can cancel and get a full refund of any amount paid.

## Shelf life
For food, we follow FSSAI's requirement on remaining shelf life at the time of delivery for online sales, and we pick the earliest-expiring stock that meets it. Check the date on the pack when you receive it.`,
  },
  refunds: {
    title: "Cancellation, returns & refunds",
    seoDescription: "How to cancel an order and how returns and refunds work at Varad Creation.",
    body: `## Cancelling an order
- You can cancel from your order page any time **before we start packing**. There is no cancellation fee.
- After packing has started, raise a request from the order page. We will try to stop the order and tell you the outcome.
- If you paid by UPI, the full amount is refunded for a cancelled order.

## Wrong, damaged, defective, expired or missing items
You are entitled to a replacement or refund if an item is:
- wrong, missing, damaged, leaking or tampered with;
- defective or not as described;
- past its expiry date, or delivered with less remaining shelf life than FSSAI requires for online food sales;
- delivered late against the delivery window we committed to (unless caused by events outside our control).

Report it from the order page (**Need help with this order?**) or by phone/WhatsApp {{phone}}, ideally within {{issueReportHours}} hours of delivery, with a photo of the item and label if possible. Please keep the pack until we respond. Reporting later does not take away your rights under consumer law.

## Change of mind
Opened food packs can't be returned for change of mind, for hygiene and food-safety reasons. For non-food items, please contact us before returning anything.

## How refunds work
- Approved refunds go back by UPI to the account you paid from (for COD orders, by UPI to a number/ID you confirm with us).
- Refunds are processed within {{refundProcessingDays}} days of approval. Your order page shows refund status.
- Items returned to us are inspected before they are resold — damaged, opened or expired food is never resold.

## Substitutions
If an item is unavailable after you order, we will ask for your approval before substituting. If the revised total is lower, we refund the difference.`,
  },
  payments: {
    title: "Payment information",
    seoDescription: "How to pay for Varad Creation orders: UPI and cash on delivery.",
    body: `## Ways to pay
- **UPI** — pay with any UPI app to our business UPI ID, shown with a QR code and payment button after you place the order.
- **Cash on delivery** — pay the delivery partner in cash or by UPI when your order arrives.

There are no payment, convenience or cash-on-delivery fees.

## How UPI payment works here
1. Place your order and choose UPI.
2. Pay the exact amount within {{upiMinutes}} minutes. **Check that the payee name matches before you pay.**
3. Enter the UPI transaction ID (UTR) from your UPI app. A screenshot is optional.
4. We check our bank / UPI account and confirm your order once the money is received.

Submitting a UTR or screenshot does not by itself confirm payment. If we can't find your payment, we'll ask you to check the details. If the payment window ends before you submit a reference, the order is cancelled automatically — if you had already paid, contact us with your UTR and we will refund you.

## Security
We never ask for your UPI PIN, OTP, card or bank details. Our staff will never ask you to “receive money” by entering your PIN.

## Refunds
See [Cancellation, returns & refunds](/cancellation-refund-policy).`,
  },
  grievance: {
    title: "Grievance redressal",
    seoDescription: "How to raise a complaint with Varad Creation and how we handle it.",
    body: `We take every complaint seriously.

## How to raise a complaint
- From your order: open the order and use **Need help with this order?** You get a request number immediately.
- From your account: **Help & privacy requests**.
- By phone / WhatsApp: {{phone}}. Email: {{email}}.

## Grievance officer
- Name: {{grievanceName}}
- Designation: {{grievanceDesignation}}
- Phone: {{grievancePhone}}
- Email: {{grievanceEmail}}
- Address: {{address}}

## Timelines
- We acknowledge your complaint within **48 hours**.
- We aim to resolve it within **one month** of receiving it.
- You can see the status and our response with your request number in your account.

## If you're not satisfied
You can contact the National Consumer Helpline (1915, consumerhelpline.gov.in) or approach the consumer commission with jurisdiction.`,
  },
  faq: {
    title: "Frequently asked questions",
    seoDescription: "Answers about delivery, payment, coupons and orders at Varad Creation.",
    body: `## Where do you deliver?
Across {{areas}}. Enter your pincode on the homepage or at checkout to check.

## How fast is delivery?
Within {{windowHours}} hours of order confirmation. COD orders are confirmed by the shop; UPI orders are confirmed after we verify your payment.

## What does delivery cost?
{{deliveryFee}} on orders below {{freeAbove}} (after coupon discounts), free at {{freeAbove}} and above. No other fees.

## Do I need an account to shop?
You can browse and fill your cart without an account. You'll sign in (or register with a one-time code to verify your number) at checkout. Your cart stays as it is.

## How do I pay?
UPI or cash on delivery. See [Payment information](/payment-information).

## I paid by UPI but my order isn't confirmed yet.
We confirm after checking our account, during shop hours ({{hours}}). Make sure you entered your UTR on the order page.

## Can I use more than one coupon?
One coupon per order.

## Can I cancel?
Yes, from your order page until we start packing. After that, raise a request from the order page.

## Are the products genuine?
We sell sealed, branded packs bought for resale. Product information on the site comes from the pack label.

## Something's wrong with my order.
Use **Need help with this order?** on the order page, or call {{phone}}. See [Cancellation, returns & refunds](/cancellation-refund-policy).`,
  },
};
