# Status: softball/donate

**Updated:** 2026-11-23 · **Branch:** `home-feed` (PR #6) · **Spec:** [`overview.md`](./overview.md)

## SESSION HANDOFF
- Phase 1 built: `/donate` page + intercepted modal, all Support links → `/donate`, article Support block, GA funnel events.
- Phase 2 (not started): embedded PayPal/Venmo/card checkout, server create/capture, `donations` table, PayPal webhooks, GA from confirmed captures. Needs PayPal business REST client id/secret.
- Verified manually: the Support click opens PayPal's checkout window over the page (PayPal blocks automated browsers at its bot check, so a real donation must be tried by a human).
