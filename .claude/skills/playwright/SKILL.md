---
name: playwright
description: Complete browser automation with Playwright. Used for running e2e tests and self-verifying UI slices during prototyping.
metadata:
  audience: developers
  workflow: testing
---

## What I Do

Provide complete browser automation with Playwright for e2e testing and self-verification.

## Path Resolution

Playwright is installed at `clients/web/node_modules/.bin/playwright` and also available globally.

## Critical Workflow

1. Auto-detect dev servers before running tests
2. Write test scripts to `/tmp` for ad-hoc verification
3. Use visible browser by default (headless: false)
4. Parameterize URLs — never hardcode localhost

## Setup

```bash
cd clients/web && npx playwright install --with-deps
```

## Execution Pattern

```typescript
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto("http://alpha.jouvae.com");
// ... interactions ...
await browser.close();
```

## Common Patterns

- Test page (multiple viewports)
- Test login flow
- Fill and submit form
- Check for broken links
- Capture screenshot on failure

## Helpers

- `detectDevServers()` — Auto-detect running dev servers
- `safeClick(page, selector)` — Click with retry
- `safeType(page, selector, text)` — Type with retry
- `waitForSelector(page, selector, timeout)` — Wait with timeout

## Authentication & data setup (real flow only — never mint sessions)

Authenticate by driving the **real auth flow** as a user would: navigate the sign-up / sign-in
pages, which call the `/api/v1/...` auth endpoints through the **Dorothy HTTP→gRPC proxy**. The
session cookie is set by that flow. Do **NOT**:

- mint/forge a session token, set a fake `__jouvae-session` cookie, or inject a fabricated auth header;
- call the backend gRPC services directly (always go through Dorothy `/api/v1/...`);
- seed scenario data via SQL/grpcurl or any path that bypasses an entity's create RPC — create it by
  driving the app or its real `/api/v1/...` RPCs (a non-ULID id is a tell that a bypass happened).

(Under integration tests the equivalent is `go test -tags testmode` + `libs/go/tests` helpers — see
`.claude/agents/go-tester.md`.)

## Custom HTTP Headers

`setExtraHTTPHeaders` is for non-auth headers (CSRF token, request-id, etc.) — never for forging a
session:

```typescript
await page.setExtraHTTPHeaders({
  "X-CSRF-Token": "..."
});
```

## Troubleshooting

- If selectors fail, check for overlapping elements, iframes, or shadow DOM
- Use `page.screenshot()` for visual debugging
- Use `page.content()` to inspect DOM state
