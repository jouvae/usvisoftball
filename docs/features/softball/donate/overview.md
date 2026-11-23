# Feature: softball/donate — on-site donate panel (PayPal hosted button) + GA funnel

**Started:** 2026-11-23 · **Branch:** `home-feed` (PR #6) · **Tier:** T2 (public, money-adjacent; no money handled by us)
**Driver:** human 2026-11-23 — article CTA to support the Federation; donating without leaving the
site; a modal on every Support link; tracked in Google Analytics. Phase 1 of the plan (Phase 2 =
embedded PayPal/Venmo/card checkout + server-confirmed donations table, needs PayPal REST creds).

## Decisions
| # | Decision |
|---|---|
| D1 | Every Support entry point (nav pill, footer, home Get Involved card, /get-involved, article block) links to **`/donate`**. In-site clicks are intercepted into the `(public)` `@modal` slot (`(.)donate`) → modal ≥ md, bottom drawer < md (shared `ResponsiveSheet`). Direct loads/refresh/shared links render the full `/donate` page. Back/Escape/close agree. |
| D2 | Payment = the Federation's **PayPal hosted Donate button** `SSAELKMM3V5TJ` (`lib/flags.ts`). Our own button calls the PayPal Donate SDK's `PayPal.Donation.Checkout({hosted_button_id}).renderTo(window)`, which opens PayPal's secure window over the page (PayPal pages can't be framed; PayPal login always uses its own window). The amount is chosen in PayPal's window. |
| D3 | Fallback: the plain hosted-button URL (new tab) is always offered; if the SDK can't load (blocked) the button is disabled and the note says to use the link. |
| D4 | Article CTA = `SupportBlock` (navy band, gold Donate) after every article body/gallery. Not part of the article text. |
| D5 | GA4 via `lib/analytics.ts` `track()` → `window.gtag` (no-op without the GA tag). Events: `support_cta_click {cta_location: nav\|footer\|home_involved\|involved_page\|article}` (one delegated listener on `[data-support-cta]`), `donate_view {presentation: modal\|drawer\|page}`, `donate_begin {method: paypal_window\|paypal_link}`, `donate_complete {value, currency, transaction_id}` (from the SDK's onComplete), `donate_error {reason: sdk_unavailable}`. No personal data. |
| D6 | GA is not the record of donations (ad blockers, closed windows). PayPal is, until Phase 2 adds a server-confirmed `donations` table. |

## Human follow-ups
- In GA4 admin: mark `donate_complete` as a key event; register `cta_location`, `presentation`, `method` as custom dimensions.
- Confirm `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set in `fly.toml [build.args]`.
- Do one real donation in a normal browser after deploy (automation is blocked by PayPal's bot check).
