# Scenarios: softball/donate

Specs: `tests/e2e/donate/donate-web.spec.ts` (read-only; the PayPal SDK is stubbed, GA spied).

- **donate-web-001** — Given any public page, when the reader clicks the nav Support pill, then the donate panel opens as a modal/drawer over the page at `/donate`, named "Support Team USVI"; Back closes it and returns to the page.
- **donate-web-002** — Given a direct load of `/donate`, then a full page renders (200, no modal) with one h1 and the hosted-button fallback link.
- **donate-web-003** — Given any article, then it ends with the Support block whose CTA links to `/donate` and is tagged `article`.
- **donate-web-004** — Given the panel, when the reader clicks "Donate with PayPal", then PayPal checkout opens for hosted button `SSAELKMM3V5TJ`; when PayPal reports completion, a thank-you shows the amount and GA receives `support_cta_click → donate_view → donate_begin → donate_complete {value, currency, transaction_id}`.
- **donate-web-005** — Given PayPal's script can't load, then the button is disabled, the note points to the PayPal.com link, and `donate_error` is sent.
- **donate-web-006** — Given `/es`, the Support pill opens the panel in Spanish at `/es/donate`.
