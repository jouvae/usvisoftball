# ECA Checkpoints — repo default

Human-in-the-loop gates where an ECA command pauses, presents what it has, and waits
for a decision. The human selects which to be involved in; **the repo default is
all**. Per-feature selection is stored in `status.md` and overrides this default. A
re-run respects the stored selection.

The flow is runnable **fully checkpointed, partially checkpointed, or fully
autonomous** based on this config. An unselected checkpoint proceeds automatically.

| # | Checkpoint | Owned by | What the human confirms |
|---|---|---|---|
| 1 | **post-triage** | `/triage` | tier + activation manifest |
| 2 | **post-problem-statement** | `/empathize` | the validated problem before designing (also the empathize **kill** point) |
| 3 | **post-prototype / pre-build** | `/conceptualize` | the direction before hardening (also the prototype **kill/pivot** point) |
| 4 | **pre-merge** | `/actualize` | gate results — dcon + both red-team levels — before merge to main |
| 5 | **pre-deploy** | `/actualize` | before production rollout |

## How to set per-feature

Edit the Checkpoints block in `docs/features/{group}/{feature}/status.md`. Check the
boxes for checkpoints you want to be paused on; uncheck the rest. Example — a T1
patrol run fully autonomous except the merge gate:

```markdown
## Checkpoints (human-in-the-loop)
- [ ] post-triage
- [ ] post-problem-statement
- [ ] post-prototype / pre-build
- [x] pre-merge
- [ ] pre-deploy
```

## Defaults by tier (guidance, not enforced)

The repo default is all-on regardless of tier. As teams calibrate, these are sane
starting points a human may set per feature:

- **T1 Patrol** — pre-merge only; the rest autonomous (the bet is the experiment).
- **T2 Sortie** — post-problem-statement + pre-merge + pre-deploy.
- **T3 Campaign** — all five; never run a Campaign fully autonomous.

Lowering checkpoints is a convenience, not a tier de-escalation — it does not change
which gates *block* (dcon + red-team always block merge at every tier).
