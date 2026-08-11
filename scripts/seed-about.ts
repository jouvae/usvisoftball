// Canonical seed for the public /about page (feature softball/about, slice 1).
//
// Goes through the sanctioned write paths in lib/board — `upsertMission`,
// `upsertBoardTerm`, `createBoardMember` — and NOTHING else. No raw SQL, no direct
// table inserts. This proves the write paths work end to end, the same contract as
// scripts/seed-articles.ts.
//
// Idempotency has two shapes here:
//   - mission + terms use UPSERT (onConflict slug), so a re-run overwrites in place and
//     the term id is always returned (needed to attach members);
//   - members are a pure INSERT guarded by the (term_id, name) unique constraint, so a
//     re-run's duplicate raises Postgres unique_violation, surfaced by supabase-js as
//     `error.code === "23505"`. We catch ONLY that (row already present) and RE-THROW
//     everything else — a broad catch would swallow the exact failures this seed exists
//     to catch (RLS/permission denial, NOT-NULL/CHECK violation, bad env/connection),
//     exiting 0 having written nothing and leaving /about silently empty.
//
// Relative imports (not `@/…`) so the standalone runner resolves cleanly.
import { createBoardMember, upsertBoardTerm, upsertMission } from "../lib/board";
import { SEED_BOARD_TERMS, SEED_MISSION } from "../lib/seed/about-fixtures";

async function main(): Promise<void> {
  let membersCreated = 0;
  let membersExisting = 0;

  await upsertMission(SEED_MISSION);
  console.log("  mission  about_mission (upserted)");

  for (const { term, members } of SEED_BOARD_TERMS) {
    const saved = await upsertBoardTerm(term);
    console.log(`  term     ${saved.slug} (upserted)`);

    for (const member of members) {
      try {
        await createBoardMember({ ...member, termId: saved.id });
        membersCreated += 1;
        console.log(`  member   ${saved.slug} / ${member.name}`);
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === "23505") {
          membersExisting += 1;
          console.log(`  exists   ${saved.slug} / ${member.name}`);
          continue;
        }
        // Any non-duplicate error is fatal — fail loudly, do NOT swallow.
        throw err;
      }
    }
  }

  const totalMembers = membersCreated + membersExisting;
  console.log(
    `seed complete: ${membersCreated} members created, ${membersExisting} already existed`,
  );

  if (totalMembers === 0) {
    // A run that created nothing AND matched nothing is a failure, not a success.
    throw new Error(
      "seed created or matched zero board members — refusing to exit 0",
    );
  }
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
