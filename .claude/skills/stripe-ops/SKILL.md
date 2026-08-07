---
name: stripe-ops
description: >-
  Operate the Stripe CLI to make real Stripe API calls from a terminal — verify
  transactions while running tests, drive/replay webhooks, and analyze Stripe
  accounts (balance, customers, charges, payouts, payment intents, disputes,
  subscriptions, Connect transfers, events). Use this whenever a task needs to
  TALK TO Stripe: confirming a PaymentIntent reached a status after a test,
  triggering test webhook events, forwarding webhooks to the local backend,
  reconciling a booking/reservation against its Stripe object, or auditing an
  account read-only. This is the operational counterpart to the official
  `stripe` plugin skills (stripe:stripe-best-practices, stripe:test-cards,
  stripe:explain-error) which cover INTEGRATION DESIGN — defer to those for "how
  should I build/architect a Stripe integration" and use this skill for "go
  query/exercise the live Stripe API". Test mode is the default and the safe
  path; live mode requires explicit user confirmation.
---

# Stripe operations (CLI + plugin)

You drive Stripe through the installed **Stripe CLI** (`stripe`, on PATH) which is
already authenticated. This skill is for *making real calls to Stripe* —
verifying transactions during tests and analyzing accounts. For integration
*design* questions, defer to the official Stripe plugin (see
[Plugin & MCP](#plugin--mcp-defer-to-these-for-design)).

## 0. Golden rules (read first)

1. **Test mode is the default and is safe.** Every `stripe` command runs in
   **test mode** unless you pass `--live`. Do read-only and test-mode work
   freely without asking. **Never pass `--live` unless the user explicitly asked
   to operate on live data, and confirm before any *mutation* in live mode.**
2. **Never print secret keys.** Keys live in `~/.config/stripe/config.toml`
   (CLI) and `services/alpha/.env.local` (`STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`). Read them only if a command needs them; never echo,
   log, or paste a key (`sk_…`, `rk_…`, `whsec_…`) into output, a file, or a
   commit. Prefer the CLI's stored auth over handling raw keys.
3. **Default to read-only when analyzing.** Account analysis = `list`/`retrieve`
   only. Creating/refunding/canceling objects is a *mutation* — do it only when
   the task requires it, keep it in test mode, and say what you're about to do.
4. **Output is JSON → parse with `jq`.** Pipe to `jq` for assertions and
   aggregation rather than eyeballing. Use `--limit` to bound result sets.

## 1. CLI essentials

The CLI is authed via `~/.config/stripe/config.toml`, which holds two profiles:

| Profile     | Modes available | Use for |
|-------------|-----------------|---------|
| `default`   | test only       | safe default for tests/analysis |
| `jouvae`    | test **and** live | the real Jouvae account; live needs `--live` + confirmation |

```bash
stripe config --list              # show profiles (values are keys — do not echo elsewhere)
stripe customers list --limit 1   # test mode by default; emits JSON
```

Global flags that matter:

| Flag | Meaning |
|------|---------|
| *(none)* | **test mode** (default — the safe path) |
| `--live` | switch to **live** data — explicit opt-in, confirm before mutations |
| `-p, --project-name jouvae` | select the `[jouvae]` profile |
| `--api-key <key>` / `STRIPE_API_KEY` env | override stored auth (avoid; prefer profiles) |
| `--stripe-account acct_…` | act on a **connected account** (Connect — this project uses Connect transfers) |
| `--test-clock clock_…` | bind a request to a [test clock](#5-test-clocks-billingsubscription-time) |
| `--limit <n>` | cap objects returned |

Every resource supports `list`, `retrieve <id>`, `create`, `update`, plus verbs
like `payment_intents capture|cancel|confirm`. Discover with `stripe <resource> --help`.

## 2. Verifying transactions while running tests

The backend's finance module records Stripe's PaymentIntent id as the
**`RailReference`** (`pi_…`) on each payment intent, and maps booking/reservation
context into the PaymentIntent **`metadata`**. That id is the join key between a
test's result and Stripe.

**Pattern — assert a PaymentIntent reached a status:**
```bash
# pi id comes from the RPC/DB result under test (createResp…GetRailReference())
stripe payment_intents retrieve pi_XXXX | jq '{id, status, amount, currency, metadata}'
# assert: .status == "succeeded" | "requires_payment_method" | "canceled" | …
```

**Pattern — find the object a test just created (no id handy):**
```bash
stripe payment_intents list --limit 5 \
  | jq '.data[] | {id, status, amount, created, metadata}'
stripe charges list --limit 5 | jq '.data[] | {id, paid, amount, status, payment_intent}'
```

**Pattern — exercise a webhook handler end-to-end (local backend):**
The backend verifies webhooks against `STRIPE_WEBHOOK_SECRET` and handles
`payment_intent.*` events (see `services/alpha/modules/finance/rails/stripe/`).
```bash
# Terminal A: forward Stripe test events to the running backend webhook route.
#   `stripe listen` prints a whsec_… — that signing secret must match the
#   backend's STRIPE_WEBHOOK_SECRET for signature verification to pass.
stripe listen --forward-to localhost:PORT/api/v1/webhook/finances

# Terminal B: synthesize a realistic event (creates needed side-effect objects).
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded
stripe trigger --help    # full event list (account.updated, balance.available, …)
```

**Test cards / fixtures:** card numbers for success / decline / 3DS scenarios come
from the plugin's **`stripe:test-cards`** skill — invoke it rather than
memorizing numbers. For scripted object graphs use `stripe fixtures <file.json>`.

**Reconcile a booking against Stripe (cross-check):**
```bash
# given a pi id from a bok-…/reservation, confirm amount + metadata line up
stripe payment_intents retrieve pi_XXXX \
  | jq '{status, amount, currency, booking: .metadata}'
```

## 3. Analyzing Stripe accounts (read-only)

For account audits, **stay in `list`/`retrieve`**. Bound everything with `--limit`
and shape with `jq`. Default to test mode; only add `--live` when the user wants
real account data and has said so.

```bash
stripe balance retrieve | jq '{available, pending}'
stripe customers list --limit 100 | jq '.data | length'
stripe charges list --limit 100 \
  | jq '[.data[] | select(.status=="succeeded")] | {count: length, total: (map(.amount) | add)}'
stripe payouts list --limit 20 | jq '.data[] | {id, amount, arrival_date, status}'
stripe disputes list --limit 20 | jq '.data[] | {id, amount, reason, status}'
stripe subscriptions list --limit 50 | jq '.data[] | {id, status, customer, current_period_end}'
stripe events list --limit 30 | jq '.data[] | {type, created, id}'
```

**Connect (this project uses connected accounts + transfers):**
```bash
stripe accounts list --limit 50 | jq '.data[] | {id, charges_enabled, payouts_enabled}'
stripe transfers list --limit 20 | jq '.data[] | {id, amount, destination}'
# inspect activity *inside* a connected account:
stripe charges list --stripe-account acct_XXXX --limit 10
```

**Pagination / time filtering:** use `--starting-after <id>` to page, and filter
client-side with `jq` on the `created` epoch (e.g.
`select(.created > 1717200000)`) — the CLI does not take human dates inline.

## 4. Common recipes

| Goal | Command |
|------|---------|
| Confirm a PI succeeded | `stripe payment_intents retrieve pi_… \| jq .status` |
| Latest N payment intents | `stripe payment_intents list --limit N \| jq '.data[].id'` |
| Trigger a webhook event | `stripe trigger payment_intent.succeeded` |
| Forward webhooks to backend | `stripe listen --forward-to localhost:PORT/api/v1/webhook/finances` |
| Replay one past event | `stripe events resend evt_…` |
| Account balance | `stripe balance retrieve` |
| Succeeded-charge total | `stripe charges list --limit 100 \| jq '[.data[]\|select(.paid)\|.amount]\|add'` |
| List connected accounts | `stripe accounts list` |
| Refund a charge (test, mutation) | `stripe refunds create --charge ch_…` |
| Explain an error code | invoke `stripe:explain-error` skill |
| Test card numbers | invoke `stripe:test-cards` skill |

## 5. Test clocks (billing/subscription time)

To test subscriptions, trials, prorations, and renewal failures *without waiting*,
use **test clocks** — attach a customer, then advance simulated time. Background:
`docs/stripe/testing.md`; full reference:
<https://docs.stripe.com/billing/testing/test-clocks>.

```bash
stripe test_helpers test_clocks create --frozen-time $(EPOCH)
stripe customers create --test-clock clock_… --name "Test"
stripe test_helpers test_clocks advance clock_… --frozen-time $(LATER_EPOCH)
```
(`Date.now()` isn't available here — get an epoch from the shell, e.g.
`date +%s`, when you need one.)

## 6. Plugin & MCP (defer to these for design)

The official **`stripe` plugin** (`stripe@claude-plugins-official`) is installed and
complements this skill. Use it; don't reinvent it:

- **Skills** — `stripe:stripe-best-practices` (API/Connect/Billing design,
  security, key handling), `stripe:test-cards`, `stripe:explain-error`,
  `stripe:upgrade-stripe`, `stripe:connect-recommend`, plus directory/projects.
  When a request is about *how to architect or secure* a Stripe integration,
  route there, not here.
- **MCP** — a Stripe MCP server is configured at `https://mcp.stripe.com`
  (`mcp__plugin_stripe_stripe__authenticate` to connect). It exposes richer
  programmatic queries and the `stripe_implementation_planner` — prefer it for
  complex/multi-step account queries when authenticated; fall back to the CLI
  recipes above otherwise.
- **Agent** — `stripe:Company Researcher` infers a Connect integration shape from
  a company URL/description.

**Division of labor:** *design & security* → plugin skills/MCP; *making real
calls to verify transactions and analyze accounts* → this skill's CLI recipes.

## 7. Reference

- Stripe testing overview: <https://docs.stripe.com/testing>
- CLI reference: <https://docs.stripe.com/cli>
- Webhooks / `listen` / `trigger`: <https://docs.stripe.com/webhooks> · <https://docs.stripe.com/cli/trigger>
- API objects: <https://docs.stripe.com/api>
- Local notes: `docs/stripe/testing.md` (test clocks), `docs/stripe/analytics.md`
- Project Stripe code: `services/alpha/modules/finance/rails/stripe/`
