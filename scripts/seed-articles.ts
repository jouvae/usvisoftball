// Canonical seed for the public news feed (slice-02 §2.4).
//
// Goes through the ONE canonical write path — `createArticle()` — and NOTHING else.
// No raw SQL, no direct table inserts. This proves the write path works end to end.
//
// Idempotent, but the catch is NARROW: `slug` is unique, so a re-run's duplicate
// insert raises Postgres `unique_violation`, surfaced by supabase-js as
// `error.code === "23505"`. We catch ONLY that (treat the row as already present)
// and RE-THROW everything else. A broad catch would swallow the exact failures this
// slice exists to prevent (RLS/permission denial, NOT-NULL violation, bad env /
// connection) — the seed would exit 0 having inserted nothing and /news would be
// silently empty. So we fail loudly on any other error, and assert a nonzero
// created-or-existing count before exiting 0.
//
// Relative imports (not `@/…`) so the standalone runner resolves cleanly.
import { createArticle } from "../lib/articles";
import { SEED_ARTICLES } from "../lib/seed/fixtures";

async function main(): Promise<void> {
  let created = 0;
  let existing = 0;

  for (const input of SEED_ARTICLES) {
    try {
      await createArticle(input);
      created += 1;
      console.log(`  created  ${input.slug}`);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "23505") {
        existing += 1;
        console.log(`  exists   ${input.slug}`);
        continue;
      }
      // Any non-duplicate error is fatal — fail loudly, do NOT swallow.
      throw err;
    }
  }

  const total = created + existing;
  console.log(`seed complete: ${created} created, ${existing} already existed`);

  if (total === 0) {
    // A run that created nothing AND matched nothing is a failure, not a success.
    throw new Error(
      "seed created or matched zero articles — refusing to exit 0",
    );
  }
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
