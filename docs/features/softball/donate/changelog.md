# Changelog: softball/donate

## 2026-11-23 — Phase 1
On-site donate panel (`/donate`, modal/drawer for in-site clicks) using the Federation's PayPal
hosted Donate button through PayPal's Donate SDK; every Support link points at it; a Support
block ends every article; GA4 funnel events (`support_cta_click`, `donate_view`, `donate_begin`,
`donate_complete`, `donate_error`) via `lib/analytics.ts`. Retired the "opens PayPal in a new tab"
assertions in shell-mvp and home-hero-involved.
