# E-commerce & Donations Platform Brief — USVI Softball Federation

**Prepared:** 2026-07-09
**Context:** Non-profit sports federation building a new website on Next.js (React). Two commerce needs: (1) online donations/fundraising and (2) a small merch catalog (apparel, hats — tens of SKUs, low-to-moderate order volume, small volunteer-run staff, tight budget). Client proposed BigCommerce or Magento/Adobe Commerce and asked for a comparison.

**Bottom line up front:** Neither BigCommerce nor Magento/Adobe Commerce is the right foundation here. Magento/Adobe Commerce is disqualified on cost and operational burden alone for an org this size. BigCommerce is workable but is more platform than this catalog needs. The better fit is to **split the two problems**: use a donor platform (Stripe directly, or Givebutter/Donorbox) for fundraising, and a lightweight, Next.js-native commerce layer (Shopify Basic/Headless, or Snipcart/Stripe Checkout) for the merch table. Full recommendation in Section 4.

---

## 1. BigCommerce vs Magento/Adobe Commerce — head-to-head for this profile

| Dimension | BigCommerce | Magento / Adobe Commerce |
|---|---|---|
| **Hosting model** | SaaS — BigCommerce hosts, patches, and scales the platform | Two flavors: **Magento Open Source** (free, self-hosted — you run the servers) and **Adobe Commerce** (licensed, offered on-prem or "Cloud" with Adobe-managed infra) |
| **Core pricing (2026)** | Core $29/mo, Growth $79/mo, Scale $299/mo, Performance from $1,499/mo (annual billing; add ~$10–$34/mo if paying monthly) [bigcommerce.com/pricing](https://www.bigcommerce.com/pricing/) | Open Source: $0 license, but you own hosting/dev/security. Adobe Commerce: **$22,000–$125,000+/year** license alone, scaled by GMV, separate from hosting/dev [costbench.com](https://costbench.com/software/enterprise-ecommerce/adobe-commerce/), [elogic.co](https://elogic.co/blog/magento-pricing-explained/) |
| **Transaction fees** | $0 if you use an approved "Embedded Payment Provider" (Stripe, PayPal, etc.); otherwise a new (as of June 1, 2026) "Open Payment Provider Fee" of 2.0% (Core) / 1.0% (Growth) / 0.6% (Scale) on top of normal card fees [netalico.com](https://netalico.com/blogs/netalico-digest/bigcommerce-2026-pricing-update), [merchantinsiders.com](https://merchantinsiders.com/blogs/bigcommerce-fees/) | Magento itself charges no transaction fee; you pay your payment gateway's rate directly (e.g., Stripe's 2.9%+30¢) |
| **PCI/security burden** | Low. BigCommerce is the merchant of record for platform infrastructure; SaaS model "significantly mitigates" PCI scope because you generally never touch raw card data [bigcommerce.com/articles/ecommerce/pci-compliance](https://www.bigcommerce.com/articles/ecommerce/pci-compliance/) | High for self-hosted Open Source: the store operator signs the PCI Self-Assessment Questionnaire and Attestation of Compliance, and owns patch management, TLS config, WAF, quarterly ASV scans, file-integrity monitoring, etc. Monthly Adobe security patches are described as "half the PCI burden" on its own [mgt-commerce.com](https://www.mgt-commerce.com/blog/what-is-pci-compliance-in-magento-hosting/), [feroot.com](https://www.feroot.com/blog/pci-dss-compliance-for-magento/). Adobe Commerce Cloud shifts infra to Adobe but license cost balloons (see above). |
| **Headless/API support for Next.js** | Strong, first-party. **Catalyst** is BigCommerce's own Next.js storefront starter (React Server Components + GraphQL Storefront API); reported build times "days to weeks, never more than 3 months" for early adopters [catalyst.dev](https://www.catalyst.dev/), [github.com/bigcommerce/catalyst](https://github.com/bigcommerce/catalyst) | Possible via REST/GraphQL, but no first-party, actively-championed Next.js starter. Adobe's own headless framework, **PWA Studio**, is not deprecated but is no longer Adobe's investment focus (Adobe is pushing "Edge Delivery Services" instead); one 2026 estimate puts new Adobe Commerce headless builds at ~60% custom Next.js + GraphQL adapters vs ~40% PWA Studio, i.e., you're mostly building the integration yourself [iwdagency.com](https://www.iwdagency.com/blogs/news/headless-commerce-2026/), [mobiloud.com](https://www.mobiloud.com/blog/adobe-commerce-pwa-studio) |
| **Ease of use for non-technical volunteers** | Good — hosted admin panel, no server/ops knowledge needed, similar UX to Shopify | Poor for Open Source (needs a sysadmin/developer just to keep the site alive); Adobe Commerce Cloud admin is still a full enterprise commerce console, built for merchandising teams, not volunteers |
| **Developer effort to build & maintain** | Moderate upfront (headless build via Catalyst), low ongoing (SaaS handles upgrades/security) | Open Source: high upfront + high ongoing (you own upgrades, security patching, scaling). Adobe Commerce: implementations typically run **4–8 months**, $100K–$250K for a mid-market build, with agency retainers of **$3,000–$15,000/month** for ongoing maintenance [bemeir.com](https://bemeir.com/articles/magento-1-to-adobe-commerce-realistic-timeline-budget/), [elogic.co](https://elogic.co/blog/adobe-commerce-b2b-cost/) |
| **Suitability for tens-of-SKUs merch catalog** | Overbuilt but tolerable — you'd use a small fraction of its B2B/catalog features | Severely overbuilt — Magento's data model, multi-store/multi-warehouse tooling, and enterprise catalog engine exist for catalogs orders of magnitude larger than a hats-and-jerseys table |

**Verdict on the head-to-head:** if forced to choose only between these two, **BigCommerce wins decisively** — SaaS hosting removes the PCI/patching burden from a volunteer team, first-party Next.js support (Catalyst) shortens dev time, and entry pricing ($29–79/mo) is compatible with a small non-profit budget. Magento Open Source's "free" license is a false economy once you count hosting, security operations, and developer time; Adobe Commerce's licensed tier is flatly not built for an org this size.

---

## 2. Challenging the premise: is either platform actually right?

### Why Magento/Adobe Commerce is overkill — quantified

- **License cost alone exceeds the federation's likely total annual operating/IT budget.** Adobe Commerce license tiers start around **$22,000/year** (on-prem, sub-$1M GMV) and Cloud editions start near **$40,000/year**, before any hosting, development, or maintenance spend [costbench.com](https://costbench.com/software/enterprise-ecommerce/adobe-commerce/), [ecommerce.folio3.com](https://ecommerce.folio3.com/blog/how-much-does-adobe-commerce-cost/). A federation selling tens of SKUs of hats and jerseys will do a tiny fraction of the $1M+ GMV this pricing tier assumes.
- **Implementation cost and timeline are enterprise-scale.** Typical Adobe Commerce implementations take **4–8 months** and cost **$100,000–$250,000** for a mid-market build; even the "aggressive" 3–4 month path requires cutting QA corners [bemeir.com](https://bemeir.com/articles/magento-1-to-adobe-commerce-realistic-timeline-budget/). Ongoing agency retainers run **$3,000–$15,000/month** just for maintenance [elogic.co](https://elogic.co/blog/adobe-commerce-b2b-cost/) — multiples of what a volunteer-run federation would spend on its entire website.
- **Magento Open Source (the free tier) isn't actually free.** First-year total cost of ownership for Open Source is commonly cited at **$30,000–$60,000** once hosting, security, extensions, and dev time are included [digitalapplied.com](https://www.digitalapplied.com/blog/magento-vs-bigcommerce-total-cost-ownership-2026-b2b), and it hands the org a standing PCI/security-operations obligation (patch cadence, WAF, ASV scans, SAQ/AoC attestation) that a volunteer board has no capacity to own [feroot.com](https://www.feroot.com/blog/pci-dss-compliance-for-magento/).
- **Market positioning confirms the mismatch.** Multiple sources independently describe Adobe Commerce as designed for **$5M+ annual revenue** merchants; small businesses are explicitly flagged as finding "the costs and complexity prohibitive" [scandiweb.com](https://scandiweb.com/blog/what-is-magento-adobe-commerce/) (paraphrased across several implementation-agency sources reviewed).

**Conclusion: Magento/Adobe Commerce should be ruled out.** There is no version of this project (tens of SKUs, volunteer staff, non-profit budget) where its cost structure or operational model makes sense. This isn't a close call.

### Is BigCommerce itself overkill?

BigCommerce is not a bad platform, but it is still a full commerce platform (product variants, B2B tooling, multi-channel sync, abandoned-cart, enterprise catalog rules) built for catalogs and order volumes well beyond "tens of SKUs, low-to-moderate volume." At $29–79/month plus a Next.js headless build (Catalyst reduces this, but it's still a real integration project — API keys, webhooks, storefront token management, a second admin surface for volunteers to learn), it's more infrastructure than the merch table needs. It should be kept on the table as the **fallback** (Section 4) but not the first choice.

### Lighter alternatives evaluated

**Shopify (Basic + Headless/Hydrogen or Storefront API into Next.js)**
- Not publicly listed, but Shopify runs an unadvertised **nonprofit program**: NPO Lite ~$29/mo and NPO Full ~$99/mo, with reduced transaction fees (1% instead of 2%, or 0% on NPO Full with a third-party processor) and a further 10% discount for annual billing. You must contact Shopify support directly to enroll — **this could not be independently verified against an official Shopify pricing page and should be confirmed directly with Shopify before relying on it** [litextension.com](https://litextension.com/blog/shopify-for-nonprofits/), [community.shopify.com](https://community.shopify.com/t/non-profit-discount-pricing-plan-how-to-apply/239205).
- For Next.js specifically: Shopify's **Storefront API** (GraphQL) can be called directly from a Next.js app, or you can use **Hydrogen** (Shopify's own React framework, MIT-ish/open-source) hosted on Shopify's free **Oxygen** hosting. As of 2026, Hydrogen has evolved into a toolkit usable with Next.js rather than a walled framework, so "Shopify backend + Next.js frontend" is a well-supported, documented path [shopify.dev](https://shopify.dev/docs/storefronts/headless/getting-started/build-options).
- Trade-off: full custom Next.js + Storefront API builds are commonly scoped at **$10K–$150K** in agency estimates — but that range is dominated by large/complex builds; a tens-of-SKU merch table is at the very bottom of that range, and much of it can be done by directly embedding Shopify's hosted **Buy Button** or a simple product-fetch component rather than a full custom storefront [weaverse.io](https://weaverse.io/blogs/shopify-headless-pricing).

**Stripe direct (Payment Links / Checkout / Products) for merch**
- For a catalog this small, Stripe's own tooling is arguably sufficient without any commerce platform at all: **Payment Links** requires no code and is explicitly positioned for "fewer than 5 products with no variants... live in five minutes," and for creators/small businesses "selling merch" [stripe.com/payments/payment-links](https://stripe.com/payments/payment-links). For a slightly larger catalog with size/color variants, **Stripe Checkout** (API-driven, still low-code) plus Stripe's **Products/Prices** catalog gives a real (if basic) product catalog embedded in the Next.js site, with **zero markup over Stripe's base rate** (2.9% + 30¢, or the discounted non-profit rate — see Section 3) [docs.stripe.com/payments/checkout/product-catalog](https://docs.stripe.com/payments/checkout/product-catalog).
- Caveat: Stripe alone has no shopping cart, inventory decrement across variants, or shipping-rate calculator out of the box — fine for "pick a shirt size, buy one at a time" flows, weaker if the federation wants a real multi-item cart experience.

**Snipcart**
- Drop-in JS cart designed to bolt onto exactly this kind of static/Next.js site with minimal code — "simple JS drop-in," well-suited to Next.js. Pricing: **$20/month flat if under $1,000/month in sales**, else **2% of transaction volume** (plus normal payment gateway fees); free tier for dev/testing [snipcart.com/pricing](https://snipcart.com/pricing). For a federation likely doing a few hundred to low-thousands of dollars a month in merch, this lands at or near the **$20/month flat fee**, which is very cheap and requires no backend at all — Snipcart is layered onto product HTML in the Next.js pages.

**Medusa.js (open-source headless commerce)**
- MIT-licensed, zero platform transaction fees, genuinely Next.js-native (headless by design). Self-hosted infra for a small store is cheap in isolation (~**$10–15/month** on Railway, or **$50–150/month** for a "real" small production stack with Postgres/Redis/S3) [buildwithmatija.com](https://www.buildwithmatija.com/blog/medusajs-pricing-cloud-self-host-costs-2026). But — same shape of problem as Magento, just smaller: **you or a volunteer developer now own the backend**, including its updates and security, and realistic all-in cost (hosting + initial storefront dev + ongoing maintenance) is estimated at **$200–$2,000+/month** once developer time is counted [buildwithmatija.com](https://www.buildwithmatija.com/blog/medusajs-pricing-cloud-self-host-costs-2026). Reasonable only if the federation has a committed volunteer developer who wants to own this long-term; not the low-maintenance choice.

**Squarespace / Wix commerce**
- Squarespace: entry commerce plans start ~$16/mo with transaction fees (2% on cheapest tier), or **Advanced at $25/mo with 0% transaction fees** — a plausible, very-low-effort option [websitebuilderexpert.com](https://www.websitebuilderexpert.com/website-builders/comparisons/wix-vs-squarespace/), [ecommerce-gold.com](https://www.ecommerce-gold.com/wix-vs-squarespace/). Wix: commerce requires the $29/mo Core plan and up, with a larger app marketplace (500+ apps) including nonprofit donation-box apps.
- Trade-off: **neither is Next.js.** Choosing Squarespace/Wix for commerce means either (a) running the merch store on a completely separate platform/subdomain from the Next.js federation site (a real "two separate systems" split, with a different look/feel and login), or (b) abandoning Next.js as the site's foundation. Given the brief explicitly requires a Next.js frontend, these are the weakest architectural fit even though they're the easiest for volunteers.

---

## 3. Non-profit specifics

### Payment processor non-profit discounts

| Processor | Standard rate | Non-profit rate | Eligibility | Source |
|---|---|---|---|---|
| **Stripe** | 2.9% + 30¢ | **2.2% + 30¢** | Registered 501(c)(3)/charity (EIN or IRS letter) **and** ≥80% of Stripe volume must be tax-deductible donations; apply via nonprofit@stripe.com. Discount covers donations only — merch, tickets, memberships stay at standard rate. Available in US, Canada, UK, EU, Australia, NZ only. | [support.stripe.com](https://support.stripe.com/questions/fee-discount-for-nonprofit-organizations), [zeffy.com](https://www.zeffy.com/blog/stripe-for-nonprofits) |
| **PayPal** | 2.89% + $0.49 | **1.99% + $0.49** | Confirmed 501(c)(3), requires PayPal Business account + determination letter + EIN; review takes up to 3 business days; must use the "charity checkout flow" to actually get the rate applied. | [paypal.com/us/cshelp](https://www.paypal.com/us/cshelp/article/how-do-i-apply-for-the-charity-rate-help221), [zeffy.com](https://www.zeffy.com/blog/paypal-donation-fees-for-nonprofits) |

**Important implication for this project:** Stripe's discounted rate is explicitly donation-only — routing merch sales through the same Stripe account does not get the discount on those transactions, and mixing volumes could complicate the 80%-donations eligibility test. This is itself an argument for architecturally separating donations from merch (see below).

### Donation-specific platforms (Givebutter, Donorbox) vs. building your own on Stripe

| | Givebutter | Donorbox | Stripe-only (DIY) |
|---|---|---|---|
| Platform fee | 0% with tips enabled, or flat 3% if tips disabled | Free tier: 1.75% platform fee; Pro ($150/mo) reduces/removes it | $0 platform fee (you pay only Stripe's processing rate) |
| Payment processing fee | 1.9–2.9% + 30¢ | 2.2–3.95% + 30¢ (2.2% base with nonprofit Stripe discount) | 2.2–2.9% + 30¢ depending on nonprofit approval |
| Recurring donations | Built-in, self-service donor portal (update card, manage plan) | Built-in, automated recurring sign-up flow | Requires building/configuring Stripe Billing or Checkout in "subscription mode" yourself |
| Automated tax receipts | Automatic emailed receipt per transaction, customizable, includes EIN/campaign/tax info | Automatic emailed receipt per donation, customizable branding | Not automatic — you'd need to build receipt emails (e.g., via a webhook + email service) |
| Embeddable in Next.js | Yes — hosted page or embeddable widget/form | Yes — hosted page or embeddable form | Yes — fully custom, but you build all the UI/UX |
| Effort | Near-zero setup, no dev needed | Near-zero setup, no dev needed | Real dev project (receipts, recurring billing UI, donor management all DIY) |

Sources: [givebutter.com/pricing](https://givebutter.com/pricing), [donorbox.org/givebutter-vs-donorbox](https://donorbox.org/givebutter-vs-donorbox), [givebutter.com/features/donation-receipts](https://givebutter.com/features/donation-receipts), [donorbox.org/donation-receipts](https://donorbox.org/donation-receipts)

**Read:** for a volunteer-run org, Givebutter or Donorbox deliver recurring donations and IRS-ready tax receipts out of the box — features that would otherwise be a real (and easy to get subtly wrong, e.g. receipt compliance) engineering project on raw Stripe. The "0% platform fee with tips" model (Givebutter) is attractive since donors can voluntarily cover the fee, meaning close to 100% of the stated gift amount reaches the federation.

### Should donations and merch be two separate flows?

**Yes — recommended.** Reasons:
1. **Fee eligibility:** Stripe/PayPal's non-profit discount applies only to the donation portion of volume; keeping donations in a dedicated donation account (whether via Stripe directly or a platform like Givebutter/Donorbox) keeps that revenue stream clean for the discount and for accounting/audit purposes.
2. **Tax receipting:** Donations need IRS-compliant receipts (deductible-gift language, EIN, no-goods-or-services-received attestation); merch purchases are ordinary retail sales and must NOT be receipted as tax-deductible. Mixing them in one cart risks generating incorrect tax documentation.
3. **UX and reporting clarity:** Board/treasurer reporting is simpler with donations and merchandise sales in separate ledgers from day one, rather than reconciling a mixed Stripe/BigCommerce feed after the fact.
4. **Tooling fit:** the best tool for each job is different — a donation platform (Givebutter/Donorbox) or bare Stripe Checkout for gifts; a lightweight cart (Shopify/Snipcart/Stripe Products) for goods. Trying to force both through one "commerce platform" (BigCommerce or Magento) means compromising on both.

---

## 4. Recommendation

### Ranked recommendation (assuming the client is open to alternatives)

1. **Donations:** Givebutter (or Donorbox) embedded/linked from the Next.js site, using the org's Stripe account underneath (apply for the Stripe non-profit 2.2%+30¢ rate once ≥80% of Stripe volume is confirmed donations). Zero-to-low monthly cost, handles recurring gifts and tax receipts automatically, effectively no developer maintenance burden for a volunteer team.
2. **Merch:** Start with **Snipcart** ($20/mo flat under $1,000/mo sales, else 2%) or **Stripe Checkout + Products** (no platform fee, just Stripe's processing rate) dropped directly into the existing Next.js pages. Either is a small, contained integration (days, not months) that a single volunteer developer can build and maintain. If the catalog or order volume later outgrows this (e.g., needs real multi-warehouse inventory, wholesale, or dozens of variants per SKU), graduate to **Shopify Basic + Storefront API/Hydrogen** — confirm Shopify's nonprofit program (NPO Lite ~$29/mo) directly with Shopify sales before counting on it.
3. **Do not build on Medusa.js** unless the federation has a committed, ongoing volunteer developer willing to own backend hosting/security indefinitely — the framework is free, but the operational burden mirrors the same "someone has to run a server" problem as Magento Open Source, just at much smaller scale.
4. **Avoid Squarespace/Wix for commerce** given the explicit Next.js requirement — they'd force a second, disconnected system.

**Why this ranking:** it matches tool weight to task weight. Donations get IRS-compliant, zero-maintenance tooling built for non-profits specifically. Merch gets the smallest viable integration for a tens-of-SKU catalog. Total combined recurring cost is plausibly **under $50–100/month** in software fees, versus **tens of thousands per year** for Magento/Adobe Commerce or a few hundred to low thousands per month for BigCommerce plus a Catalyst build.

### Fallback: if the client insists on BigCommerce or Magento

If the board specifically wants one unified commerce platform for governance/simplicity reasons, or wants a single vendor relationship:

- **Choose BigCommerce, not Magento/Adobe Commerce, without qualification.** Magento Open Source imposes a standing PCI/security-operations burden no volunteer board should take on, and Adobe Commerce's licensed tier ($22K–$125K+/year) is disproportionate to any plausible revenue this federation's merch table will generate.
- **BigCommerce implementation path:** Core plan ($29/mo annual), use an Embedded Payment Provider (e.g., Stripe or PayPal) to avoid the new Open Payment Provider transaction fee, and build the storefront on **Catalyst** (BigCommerce's official Next.js starter) rather than a fully custom headless integration — this keeps the dev effort in the "days to weeks" range reported by early adopters rather than a multi-month build.
- **Still route donations separately** (Givebutter/Donorbox/Stripe) even in this fallback — BigCommerce is a commerce platform, not a donation/tax-receipt platform, and forcing donations through a merch cart loses the non-profit Stripe/PayPal discount and automated receipting.

---

## Sources

- [BigCommerce Pricing](https://www.bigcommerce.com/pricing/) (fetched 2026-07-09)
- [BigCommerce 2026 Pricing Update](https://netalico.com/blogs/netalico-digest/bigcommerce-2026-pricing-update)
- [BigCommerce Fees Explained 2026](https://merchantinsiders.com/blogs/bigcommerce-fees/)
- [BigCommerce PCI Compliance](https://www.bigcommerce.com/articles/ecommerce/pci-compliance/)
- [Catalyst by BigCommerce](https://www.catalyst.dev/)
- [Catalyst GitHub](https://github.com/bigcommerce/catalyst)
- [Digital Applied: Magento vs BigCommerce TCO 2026](https://www.digitalapplied.com/blog/magento-vs-bigcommerce-total-cost-ownership-2026-b2b)
- [Costbench: Adobe Commerce Pricing 2026](https://costbench.com/software/enterprise-ecommerce/adobe-commerce/)
- [Elogic: Adobe Commerce Pricing Explained](https://elogic.co/blog/magento-pricing-explained/)
- [Elogic: Adobe Commerce & B2B Store Cost 2026](https://elogic.co/blog/adobe-commerce-b2b-cost/)
- [Folio3: Adobe Commerce Cloud Pricing Breakdown](https://ecommerce.folio3.com/blog/how-much-does-adobe-commerce-cost/)
- [Bemeir: Magento 1 to Adobe Commerce Migration Timeline/Budget](https://bemeir.com/articles/magento-1-to-adobe-commerce-realistic-timeline-budget/)
- [Scandiweb: What is Magento (Adobe Commerce)?](https://scandiweb.com/blog/what-is-magento-adobe-commerce/)
- [Feroot: PCI DSS Compliance for Magento](https://www.feroot.com/blog/pci-dss-compliance-for-magento/)
- [MGT Commerce: PCI Compliance in Magento Hosting](https://www.mgt-commerce.com/blog/what-is-pci-compliance-in-magento-hosting/)
- [IWD Agency: Headless Commerce 2026](https://www.iwdagency.com/blogs/news/headless-commerce-2026/)
- [Mobiloud: Adobe Commerce PWA Studio](https://www.mobiloud.com/blog/adobe-commerce-pwa-studio)
- [Shopify: Headless build options](https://shopify.dev/docs/storefronts/headless/getting-started/build-options)
- [Weaverse: Shopify Headless Pricing 2026](https://weaverse.io/blogs/shopify-headless-pricing)
- [LitExtension: Shopify for Nonprofits 2026](https://litextension.com/blog/shopify-for-nonprofits/)
- [Shopify Community: Non-profit discount pricing plan](https://community.shopify.com/t/non-profit-discount-pricing-plan-how-to-apply/239205)
- [Stripe: Fee discount for nonprofit organizations](https://support.stripe.com/questions/fee-discount-for-nonprofit-organizations)
- [Zeffy: Stripe for Nonprofits](https://www.zeffy.com/blog/stripe-for-nonprofits)
- [Zeffy: PayPal Nonprofit Fees 2026](https://www.zeffy.com/blog/paypal-donation-fees-for-nonprofits)
- [PayPal: How do I apply for the charity rate?](https://www.paypal.com/us/cshelp/article/how-do-i-apply-for-the-charity-rate-help221)
- [Givebutter Pricing](https://givebutter.com/pricing)
- [Givebutter vs Donorbox](https://donorbox.org/givebutter-vs-donorbox)
- [Givebutter: Donation Receipts](https://givebutter.com/features/donation-receipts)
- [Donorbox: Donation Receipts](https://donorbox.org/donation-receipts)
- [Stripe Payment Links](https://stripe.com/payments/payment-links)
- [Stripe: Manage your product catalog](https://docs.stripe.com/payments/checkout/product-catalog)
- [Snipcart Pricing](https://snipcart.com/pricing)
- [Build with Matija: Medusa.js Pricing 2026](https://www.buildwithmatija.com/blog/medusajs-pricing-cloud-self-host-costs-2026)
- [Website Builder Expert: Wix vs Squarespace 2026](https://www.websitebuilderexpert.com/website-builders/comparisons/wix-vs-squarespace/)
- [Ecommerce Gold: Wix vs Squarespace](https://www.ecommerce-gold.com/wix-vs-squarespace/)

## Flagged as unverified / needs direct confirmation

- **Shopify's nonprofit program (NPO Lite/NPO Full) pricing and terms** — sourced from third-party blogs and a Shopify community thread, not from an official Shopify pricing page (the program is reportedly unlisted publicly). Confirm directly with Shopify sales before relying on these numbers.
- **BigCommerce nonprofit discounts** — no evidence of a formal published program; some blog sources vaguely claim BigCommerce offers nonprofit discounts, but this could not be confirmed on BigCommerce's own site. Treat as "ask sales," not as a known rate.
- Several pricing figures (Adobe Commerce license tiers, Medusa hosting costs, implementation cost ranges) are aggregated/estimated by third-party agency blogs rather than published directly by the vendor, since Adobe in particular does not publish official pricing. Directionally reliable and consistent across multiple independent sources, but exact dollar figures should be treated as ballpark, not quoted, in any client-facing budget document.
