# The Learning Loop

How the commands, agents, and skills get **better and better** without getting
**bigger and bigger**. This is the contract every part of the loop obeys.

## The problem this solves

A loop that only *adds* rules degrades: prompts grow, slow down, and eventually
contradict each other (the `reviewer` agent once mandated the abolished
Repository pattern — that is what append-only learning produces). Accuracy AND
efficiency only improve if lessons are **verified** and **pruned**, not just
captured and applied.

## The four moves

```
   ┌───────────────  Pre-flight (load relevant lessons)  ◀── automatic at /empathize
   ▼
Capture  →  Generalize  →  Apply (gated)  →  Verify & Prune
  ▲                                                  │
  └──────────────────  feedback  ─────────────────────┘
```

- **Pre-flight (automatic)** — at the start of `/empathize` (and any command that
  benefits), load relevant prior lessons from `.opencode/lessons/` **before** new
  work begins, surfaced by **domain/problem similarity** (group, service, problem
  keywords). A feature that references a prior lesson counts toward the
  lessons-applied metric. This is the half that stops last session's mistakes from
  recurring in this one. `/aar` is the capture side of this same loop.
- **Capture** — at the moment of failure (a QA critical, a red→green test, a
  correction, **a mid-session error resolved by `/aar`**), record
  `(error_type, agent, root_cause)`. Cheap, automatic.
- **Generalize** — turn a specific failure into a falsifiable rule with a trigger.
- **Apply (gated)** — promote to a binding rule ONLY when it recurs (≥2 features)
  or is a confirmed Critical. Provisional otherwise.
- **Verify & Prune** — track whether the target error actually stops recurring.
  Graduate rules that work; rewrite rules that don't; delete rules whose concept
  no longer exists.

## The maturity ladder (push lessons DOWN it over time)

The goal is to move every lesson toward the cheapest enforcement so prompts stay
lean. A lesson that becomes a CI check never costs a token again.

| Stage | Lives in | Prompt cost | Graduates when |
|---|---|---|---|
| 1. Observation | `.opencode/lessons/*.md` | none | root-caused |
| 2. Provisional rule | `.opencode/rules/agents/{agent}.md` (`status: provisional`) | small | recurs ≥2 features **or** confirmed Critical |
| 3. Binding rule | same file (`status: binding`) | medium | `recurrences_after == 0` across ≥3 later features |
| 4. Canonical standard | `.opencode/rules/{go-standard,data}.md`, removed from per-agent file (`status: validated`) | low (shared once) | rule is mechanically checkable |
| 5. Deterministic gate | `.claude/scripts/*.sh` + pre-commit/CI (`status: gated`) | **zero** | — terminal |

**Down-the-ladder is the win.** Up-the-ladder (new provisional rules) is normal
intake; if rules only ever move up, the loop is failing.

## Rule record schema

Every rule in `.opencode/rules/agents/{agent}.md` is a record:

```
### R-{agent}-{slug}
- trigger: <when this rule applies — a detectable condition, not a vibe>
- rule: <the single directive>
- status: provisional | binding | validated | retired | gated
- confidence: low | medium | high
- source: <lesson file(s) or audit/finding id>
- tier: <T1 | T2 | T3 | any — the ECA tier(s) the originating lesson was tagged with>
- promoted: YYYY-MM-DD
- last_validated: YYYY-MM-DD
- recurrences_after: <N times the target error reappeared since promotion>
- gate: none | script:<path> | ci
```

**Tier tagging (ECA).** Every lesson captured by `/aar` carries the active tier
(`aar` skill). The tier flows into the rule record's `tier` field. This powers the
**calibration** question: if lessons/rules tagged `T1` keep describing incidents a
`T2`/`T3` apparatus would have caught, `/improve --consolidate` proposes a **new
auto-escalation trigger** (tier-classification skill) — the loop tightening the
router, not just the agents.

Mirror each record's lifecycle fields into
`.claude/metrics/aggregated/rule-effectiveness.json` so effectiveness is
queryable (`.claude/scripts/rule-stats.sh`).

## Promotion policy (intake gate)

- A captured observation becomes a **provisional** rule immediately (low cost).
- Provisional → **binding** only if: it recurred in **≥2 features**, OR it is a
  confirmed **Critical** (security/data-loss/build-break). One-off Warnings stay
  provisional — they must earn their place. (This preserves the existing
  `/improve` "≥2 occurrences" gate.)
- **Rule edits to shared agent files are themselves reviewable changes.** The
  loop proposes; a human (or the security-review gate for security rules) ratifies
  edits to `go-implementer`, `architect`, `reviewer`, etc. No silent rewrites of
  shared auth/agent code (mirrors audit §0.4 branch-per-fix).

## Verify policy (the half most loops skip)

Every binding rule carries a falsifiable claim: *"error_type X stops recurring."*

- After each feature, the capture step increments `recurrences_after` for any rule
  whose target error reappeared.
- `recurrences_after > 0` after promotion → rule is **ineffective**: rewrite the
  trigger/directive or escalate to a deterministic gate. Do not leave it.
- `recurrences_after == 0` across ≥3 later features → rule is **validated**:
  eligible to graduate (stage 4/5) and be removed from the hot prompt.

## Prune policy (anti-bloat — run on `/improve --consolidate`)

Run every ~5 features or when any per-agent rules file exceeds its **token
budget (~1500 tokens / ~40 records)**:

1. **Dedup** overlapping rules into one.
2. **Retire** rules whose target concept no longer exists (set `status: retired`,
   keep a one-line tombstone with the date and reason — e.g. the Repository
   pattern). Retired rules are deleted at the next consolidation after 1 cycle.
3. **Graduate** validated rules into the canonical standard and delete from the
   per-agent file.
4. **Promote** mechanically-checkable validated rules to `.claude/scripts/` and
   wire into pre-commit/CI; set `status: gated`.
5. **Enforce the budget** — if still over, the lowest-value provisional rules
   (oldest, never-recurred, low-confidence) are dropped and logged.

## How the pieces connect

| Piece | Role |
|---|---|
| `/qa`, `/fix` | emit `plan-review-NNN.md` — the raw signal |
| `/implement`, `/fix` (capture step) | record observations to lessons + bump recurrence counters |
| `/improve` | classify → write lessons → promote (gated) → update rule files + effectiveness json |
| `/improve --consolidate` | the Verify & Prune pass (dedup, retire, graduate, gate, budget) |
| `.opencode/rules/agents/{agent}.md` | the binding/provisional rules each agent loads |
| `.claude/metrics/aggregated/rule-effectiveness.json` | recurrence + lifecycle state |
| `.claude/scripts/rule-stats.sh` | reports ineffective / validated / over-budget rules |
| `.claude/scripts/*.sh` (gated rules) | lessons that left the prompt entirely |

## Invariants

1. A binding rule without a falsifiable trigger is not a rule — reject it.
2. Never delete a lesson file; lessons are the audit trail. Prune *rules*, not lessons.
3. If the same error recurs after a rule was promoted to fix it, the rule —
   not the agent — is at fault. Fix the rule or gate it.
4. Per-agent rules files stay under budget. Growth without graduation is a smell.
