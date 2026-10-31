# Compliance notes & launch checklist

This file has two parts: (1) what the code does about each requirement and what the owner must still supply, and (2) the research brief (Indian e-commerce, packaged-food, legal-metrology and privacy rules as of 31 Oct 2026) the policy drafts were written from. **Not legal advice — have a lawyer/CA review before launch.** Items marked **[U]** in the brief could not be fully verified.

## Part 1 — How the store addresses it

| Requirement | In the product | Owner must supply / decide |
|---|---|---|
| Seller identity, address, contacts, grievance officer (E-Com Rules r.4) | Footer, Contact, Grievance, Terms, Privacy pages pull these from Settings; missing values show a visible "to be added" marker | Legal name, email, hours, grievance officer name/designation/phone/email |
| Complaints acknowledged in 48 h, resolved in 1 month, ticket number | Support requests get a `VC-T00001` ticket; admin Support page flags "not acknowledged > 48h" and "open over 30 days"; customers see status in their account | Staff the queue |
| Total price + break-up, fees disclosed before checkout, no drip pricing | Cart and checkout show item total, coupon, subtotal after discount, delivery fee, total; "no other fees" stated; COD has no fee | — |
| No pre-ticked boxes / dark patterns | No pre-ticked consents, no auto-added items, no fake urgency ("Only N left" uses real stock at or below the low-stock threshold), out-of-stock shown as unavailable | Keep it that way |
| Prior/lowest price next to discounts (from 1 Jan 2027) | Product page shows "Lowest price in the last 30 days" from a price-history log whenever a discount vs MRP is shown | — |
| Legal Metrology declarations online; unit sale price; never above MRP | Product page shows MRP "inclusive of all taxes", unit sale price (from net quantity), manufacturer/packer, consumer care, country of origin; the admin form refuses a price above MRP | Fill net quantity and label fields for every pack |
| FSSAI label info before purchase (ingredients, nutrition, veg/non-veg, allergens, brand FSSAI no., etc.) | Product form has every field; storefront shows only what's entered and asks shoppers to check the label/contact you when empty; label photos supported | Copy every field from real packs; upload label photos |
| Remaining shelf life at delivery (30% / 45 days) | Earliest-expiry-first picking; packing list flags batches with < 45 days; daily expiry segregation | Confirm the rule interpretation; check packs |
| FSSAI number on every bill | Bill / cash memo prints the shop's FSSAI number (shows "to be added" until set) | Shop FSSAI registration/licence — **check whether a Central licence is needed for e-commerce [U]** |
| GST | Prices MRP-inclusive; bill shows GSTIN if set | If GST-registered, a proper tax invoice (HSN, tax split) is **not** generated yet — use your billing software or ask for this feature |
| Refunds for wrong/damaged/defective/expired/late items; no blanket no-refund | Refund policy draft + admin refund flow (initiate → complete with UTR, ledger) | Issue-report window and refund processing days (Settings) |
| Privacy notice (SPDI now; DPDP from 13 May 2027) | Privacy draft itemises data, purposes, sharing (incl. delivery partners and processors), location, uploads, retention, rights, grievance, Data Protection Board; account-deletion requests via support | Review retention periods with your CA (tax/accounting) |
| Breach handling (DPDP Rule 7, from May 2027) | Audit logs, access control | Write a breach-response contact list and procedure |

## Part 2 — Research brief

Scope: own-website, inventory-model seller of packaged food and Tupperware, delivering in Pune/PCMC, paid by UPI or COD.

Points were checked in the cited official text unless marked **[U]** (unverified or ambiguous; get a lawyer or CA to review). Not legal advice.

**Coming changes**

| Date | What changes |
|---|---|
| **1 Jan 2027** | E-Commerce Amendment Rules apply |
| **13 May 2027** | DPDP duties begin; IT Act s.43A omitted |
| **1 Jul 2027** | Legal Metrology country-of-origin filter required |

---

## 1. Consumer Protection (E-Commerce) Rules 2020; Dark Patterns Guidelines 2023

You are an **inventory e-commerce entity** (r.3(1)(f)), so r.4 and r.7 apply to you. [ECR]

A nodal officer is required only if you are a company (r.4(1), substituted 2021). [ECR21]

**Display prominently (now)** [ECR]:
- Legal name.
- Address of HQ **and all branches**.
- Website details.
- Customer-care and grievance-officer email, landline and mobile (r.4(2)).
- Grievance officer's name and designation (r.4(4)).
- Return, refund, exchange, warranty, delivery and **return-shipping cost** terms (r.7(1)(a)).
- Payment modes and grievance mechanism (r.7(1)(a)).
- Payment methods, their security, **any fees payable by users**, chargeback options and the payment-provider contact (r.7(1)(c)).
- **Total price in one figure plus a break-up** of delivery, handling and tax (r.7(1)(e)).
- All notices required by other laws, i.e. sections 2–3 below (r.7(1)(b)).
- Importer details for imported goods; check the Tupperware packs (r.4(6)).

**Do / don't (now)** [ECR]:
- Acknowledge complaints within **48 hours** and resolve them within **1 month** (r.4(5)).
- Give a **ticket number** for each complaint (r.7(1)(f)).
- **No pre-ticked consent boxes** (r.4(9)).
- Charge a cancellation fee only if you bear similar charges when you cancel (r.4(8)).
- Don't refuse a return or refund for goods that are defective, spurious, not as advertised, or **delivered late** against the stated schedule, force majeure excepted (r.7(4)).
- No fake reviews (r.7(2)).
- No unjustified pricing or discrimination between customers (r.4(11)).

**From 1 Jan 2027** (G.S.R. 789(E), 9 Sep 2026) [ECR26] [PIB-ECR26]:
- Give complainants a **copy of their recorded complaint**.
- National Consumer Helpline convergence becomes **mandatory**.
- Show the **full country of origin** for imported goods.
- Show **best before/use before** dates. For food, this is "subject to" FSS law (see section 3).
- On price cuts, show the **prior price**: the lowest price in the preceding **30 days**.
- Label sponsored listings. Don't manipulate search results.
- Do a **yearly dark-pattern self-audit** and **display the compliance certificate**.

**Dark Patterns Guidelines 2023** apply to platforms, advertisers and sellers. [DPG] Relevant to a grocery store UI:
- **False urgency:** no fake "only 2 left" or "30 viewing" messages.
- **Basket sneaking:** no auto-added items, donations or add-ons. Delivery charges and tax are allowed only if disclosed at purchase. In June 2026 CCPA fined PhysicsWallah Rs 5 lakh for a pre-selected Rs 10 donation. [PIB-PW]
- **Drip pricing:** show COD, delivery and packing fees upfront. Never charge more than the checkout total.
- **Forced action:** don't make sign-up or extra data a condition of buying.
- **Interface interference:** make "No" and close as visible as "Yes".
- **Bait and switch:** don't show out-of-stock items as available.
- Also avoid confirm shaming, nagging, trick questions, disguised ads and subscription traps.

CCPA also issued a self-audit advisory on 5 Jun 2025. [CCPA-ADV]

## 2. Legal Metrology (Packaged Commodities) Rules 2011

**Declarations under r.6(1)** [LMPC]:
- Manufacturer and packer, or the importer. For food packs, FSS law governs this instead (Expl. III).
- **Country of origin** for imports.
- Common or generic name.
- Net quantity.
- Best before/use by date.
- **MRP "inclusive of all taxes"**.
- Consumer-care name, address, phone and email (6(2)).
- **Unit sale price** (Rs/g, Rs/kg, Rs/ml, Rs/L or Rs/unit), unless MRP equals the unit price (6(11)).

**Online display, r.6(10):** show all r.6(1) items online **except the month/year of manufacture or packing**. The delivered pack must still carry everything. [LMPC]

**[U]** LM r.2(be) defines "e-commerce entity" as a company, so r.6(10) may not strictly bind a proprietorship. Display the items anyway, because E-Com r.7(1)(b) requires them.

**Retailer duties** [LMPC]:
- **Never sell above MRP** (r.18(2)).
- Don't sell non-compliant packs (r.18(1)).
- No stickers over declarations, except a lower-MRP sticker (r.6(3)).

**Amendments** [LM26-1] [LM26-2]:
- G.S.R. 128(E) (13 Feb 2026) inserted r.6(10A).
- G.S.R. 312(E) (27 Apr 2026) replaced it. **From 1 Jul 2027**, sellers of imported products need a **searchable and sortable country-of-origin filter**.

**[U]** The consolidated text I used runs to 2022. Secondary reports suggest the other 2025–26 amendments don't affect retailers.

## 3. FSSAI

**Labelling and Display Regs 2020, reg 4(2):** for e-commerce sales, give all mandatory label information **before sale**, except batch number, best before, use by, expiry and manufacture/packing date. [FSS-LD]

**Each product page needs** (reg 5) [FSS-LD]:
- Name of food.
- **Ingredients**.
- **Nutrition information**.
- **Veg/non-veg logo**.
- Additives.
- Brand owner's name and full address.
- **FSSAI logo and licence number of the brand owner**, plus the manufacturer's or packer's number if different.
- Net quantity, MRP and consumer care.
- Importer and country of origin for imported food.
- Instructions for use.
- **"Contains:" allergen line**.

**E-commerce food businesses** (FSSAI s.16(5) direction re-operationalising draft licensing amendments; the copy I read is the 2022 one) [FSS-ECOM]:
- Show a **legible principal-display-panel image**.
- Give mandatory information **before purchase, free**.
- Food must have **"shelf life of 30 percent or 45 days before expiry at the time of delivery."** The "or" is ambiguous; the safe course is to meet both.
  - This was reiterated in the 3 Dec 2024 advisory [FSS-ADV24]. **[U]** That advisory is a scanned file I couldn't read; news reports confirm its content.
- Use trained delivery staff.
- No misleading images.

**[U]** I could not confirm whether this direction is still renewed or now sits in the 2026 regulations.

**Your licence** [FSS-TO] [FSS-FAQ26]:
- From **1 Apr 2026** (L&R Amendment Regs, gazette 10 Mar 2026; order of 13 Mar 2026):
  - **Registration** up to Rs 1.5 cr turnover.
  - **State licence** from Rs 1.5 cr to Rs 50 cr.
  - **Central licence** above Rs 50 cr.
- Licences no longer expire, but the annual fee continues.

**[U] High risk:** FoSCoS (1 Apr 2026) lists **"E-Commerce: no restriction on turnover threshold – Central License"** [FOSCOS-KOB]. The direction also says e-commerce food businesses, including **inventory-model** sellers, "shall obtain central license" [FSS-ECOM]. **Confirm with FSSAI** whether you need a Central licence in addition to a retail registration.

**Display your licence or registration number:**
- At the premises (reg 5(7)(d)). [FSS-LD]
- On the website. [FSS-ECOM]
- On **every bill, cash memo or invoice** (since 1 Oct 2021). [FSS-BILL]

## 4. DPDP Act 2023, DPDP Rules 2025, IT Act s.43A

**Rules commencement** (G.S.R. 846(E), 13 Nov 2025) [DPDP-R]:
- Rules 1, 2 and 17–21 (the Board) are in force now.
- Rule 4 (consent managers) starts **13 Nov 2026**.
- Rules **3, 5–16, 22 and 23** start **13 May 2027**.

**Act commencement** **[U]** (commencement notice seen only in secondary sources) [PIB-DPDP]:
- ss.1(2), 2, 18–26, 35, 38–43, 44(1) and 44(3) have been in force since 13 Nov 2025.
- **ss.3–17** and **s.44(2)**, which omits IT Act s.43A, start **13 May 2027**. [DPDP-ACT]

**[U]** MeitY proposed in January 2026 to cut the transition from 18 to 12 months. I found it not gazetted as of today.

**Now: IT Act s.43A and SPDI Rules 2011 apply** (a proprietorship counts as a "body corporate"):
- Publish a **privacy policy** covering what data you collect, why, who it goes to, and your security practices (r.4).
- Get consent for sensitive payment data (r.5); better, don't store it.
- Appoint a **grievance officer** who resolves complaints within **1 month** (r.5(9)).
- Keep reasonable security practices (r.8).

**[U]** The SPDI points above are from my knowledge of the Rules; the official copy is a scan I couldn't read. [SPDI]

**From 13 May 2027 (draft now)** [DPDP-ACT] [DPDP-R]:
- **Notice** (s.5; Rule 3) must be standalone and plain-language. It must give:
  - an **itemised list of the personal data** (name, phone, address, UPI reference, orders);
  - the **specific purposes**;
  - links to **withdraw consent** (as easily as it was given), **exercise rights**, and **complain to the Data Protection Board**.
- **Consent** must be free, specific, informed, unambiguous and given by affirmative action (s.6(1)).
  - Order fulfilment can rely on s.7(a), voluntary provision of data for that purpose.
  - **Marketing needs separate consent.**
- **Publish** how to make rights requests, your grievance response time (**at most 90 days**), and a contact person (Rules 9 and 14).
- **Security** (Rule 6): encryption, access control, backups, processor contracts, and **logs kept for 1 year**.
- **Breach** (Rule 7): notify affected users **without delay**. Notify the Board without delay, with a full report **within 72 hours**.
- **Retention:** keep order, payment and delivery data for **at least 1 year** (Rule 8(3)). Then erase it once the purpose is served (s.8(7)), unless a law such as GST requires longer.
- **Users under 18:** verifiable parental consent (Rule 10).
- **Penalties:** up to Rs 250 crore.

## 5. COD fees, invoices, refunds

**COD and delivery fees:**
- **[U]** No rule I found bans or caps COD or delivery fees.
- They must appear in the fee disclosure and the price break-up **before checkout** (r.7(1)(c),(e)). Adding them later is drip pricing. [ECR] [DPG]
- **[U]** A 2025 government probe into COD fees was reported in the press; I found no official order.
- **[U]** The MRP rule doesn't say how fees on top of MRP are treated. Label delivery and COD fees as separate service charges, and keep the goods themselves at or below MRP.

**Bill or invoice:**
- Not issuing a **bill, cash memo or receipt** is an unfair trade practice (CPA s.2(47)(vii)). [CPA] **[U]** I couldn't find a prescribed format.
- Print your FSSAI number on it. [FSS-BILL]

**GST:**
- In Maharashtra, a goods supplier must register above **Rs 40 lakh** turnover. [GST-10/2019]
- If registered, issue a **tax invoice** (s.31), or a **bill of supply** if you are under composition (s.31(3)(c)). [GST-S31]
- If not registered, **don't charge GST** (s.32(1)) and issue a plain bill. [GST-S32]

**[U]** Selling on your own website alone shouldn't force GST registration; the s.24/s.52 e-commerce triggers concern operators that collect TCS. Confirm with a CA.

**Refund timelines** (none invented here):
- E-Com r.4(10): refunds within "a reasonable period of time", or as RBI or other law prescribes. **No fixed number of days.** [ECR]
- CPA s.2(47)(viii): refusing to refund for defective goods within the period **stated on the bill** (or **30 days** if none is stated) is an unfair trade practice. **State your refund period on bills and in the policy.** [CPA]
- **[U]** I found no RBI deadline for refunds a merchant makes manually over UPI.

---

### Sources

[ECR]: https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf
[ECR21]: https://consumeraffairs.gov.in/public/upload/files/Consumer%20Protection%20(E-Commerce)%20(Amendment)%20Rules,%202021_1732704241.pdf
[ECR26]: https://consumeraffairs.gov.in/public/upload/admin/cmsfiles/whatsnews/E_Commerce_Amendment_Rules_2026_2026-09-11_18-12-39.pdf
[PIB-ECR26]: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2308759
[DPG]: https://ccpa.doca.gov.in/files/The%20Guidelines%20for%20Prevention%20and%20Regulation%20of%20Dark%20Patterns,%202023_1732707717.pdf
[CCPA-ADV]: https://ccpa.doca.gov.in/guidelines.php
[PIB-PW]: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2268302
[CPA]: https://consumeraffairs.gov.in/public/upload/files/CP%20Act%202019_1732700731.pdf
[LMPC]: https://consumeraffairs.gov.in/public/upload/admin/cmsfiles/whatsnews/Book_on_Legal_Metrology_Packaged_Commodities_Rules,2011_with_all_amendments_whatsnews.pdf
[LM26-1]: https://consumeraffairs.gov.in/public/upload/files/2026.02.13%20PCR%201st%20COO%20Filter%20on%20e-commerce%20websites_1771231030.pdf
[LM26-2]: https://consumeraffairs.gov.in/public/upload/files/2026.4.27%20PCR%202nd%20COO%20from%201.7.2027_1777348487.pdf
[FSS-LD]: https://www.fssai.gov.in/upload/uploadfiles/files/Comp_Labelling%20Display_Version%20VIII_09_09_2025.pdf
[FSS-ECOM]: https://www.fssai.gov.in/upload/advisories/2022/12/638edf17bdbb2Direction_Licensing_28_11_2022_.pdf
[FSS-ADV24]: https://www.fssai.gov.in/upload/advisories/2024/12/674efa161d756Adobe%20Scan%203%20Dec%202024.pdf
[FSS-TO]: https://www.fssai.gov.in/upload/advisories/2026/03/69b4054bb6cd6Order%20dated%2013thMarch2026_Revised%20Turnover%20threshold.pdf
[FSS-FAQ26]: https://fssai.gov.in/upload/advisories/2026/03/69c6a23234827order_27032026.pdf
[FOSCOS-KOB]: https://foscos.fssai.gov.in/assets/docs/Revised_2ndApril2026KindofBusinessEligibility.pdf
[FSS-BILL]: https://fssai.gov.in/upload/advisories/2021/10/6156936ac80bbOrder_License_Number_Print_01_10_2021.pdf
[DPDP-ACT]: https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf
[DPDP-R]: https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf
[PIB-DPDP]: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014
[SPDI]: https://www.indiacode.nic.in/ViewFileUploaded?path=AC_CEN_45_76_00001_200021_1517807324077%2Frulesindividualfile%2F&file=GSR313E_10511%281%29_0.pdf
[GST-S31]: https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter7/section31_v1.00.html
[GST-S32]: https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter7/section32_v1.00.html
[GST-10/2019]: https://gstcouncil.gov.in/sites/default/files/2024-05/notfctn-10-central-tax-english-2019.pdf
