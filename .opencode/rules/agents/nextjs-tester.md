# nextjs-tester — learned rules

Loaded by `.opencode/agents/nextjs-tester.md`. Schema + lifecycle:
[`../LEARNING-LOOP.md`](../LEARNING-LOOP.md). Budget: ~40 records.

---

### R-nextjs-tester-verify-selectors
- trigger: writing a Playwright test that clicks/queries an element by data-testid
- rule: confirm the `data-testid` matches the actual component attribute before writing the assertion; account for per-step differences (e.g. `submit-button`/`pay-button` vs `continue-button`)
- status: binding
- confidence: high
- source: 05-29-2026-create-reservations (CRIT-FE-14)
- promoted: 2026-05-29
- last_validated: 2026-05-29
- recurrences_after: 0
- gate: none

### R-nextjs-tester-getbytestid
- trigger: selecting an element by test id in Playwright
- rule: use `page.getByTestId('x')`, not `page.locator('[data-testid="x"]')`
- status: provisional
- confidence: medium
- source: 05-29-2026-create-reservations (WARN-FE-11)
- promoted: 2026-05-29
- last_validated: 2026-05-29
- recurrences_after: 0
- gate: none

### R-nextjs-tester-auth-failure-path
- trigger: writing an e2e happy-path test for an authenticated flow
- rule: include the auth-failure / unauthenticated case alongside the happy path
- status: provisional
- confidence: medium
- source: 05-29-2026-create-reservations (WARN-FE-10)
- promoted: 2026-05-29
- last_validated: 2026-05-29
- recurrences_after: 0
- gate: none
