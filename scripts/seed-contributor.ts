// Canonical seed for the test contributor user (slice-05 §4).
//
// Mirrors scripts/seed-admin.ts exactly. Goes through the ONE sanctioned create
// path — `provisionUser()` → `auth.admin.createUser({ email_confirm: true,
// user_metadata: { name } })` — then `assignRoles` UPSERTS the profile with the
// `contributor` role. The `name` ('Test Contributor') flows: user_metadata.name →
// the 0003 handle_new_user trigger → profiles.name → later the article byline
// (author_name). The upsert also heals a profile row for any pre-trigger account.
//
// Idempotent: a re-run treats an "email exists" error as already-provisioned
// (resolving the existing id so the role is still ensured). Any OTHER error is
// fatal — fail loudly (non-zero exit), mirroring scripts/seed-articles.ts.
//
// Relative imports (not `@/…`) so the standalone runner resolves cleanly.
import { provisionUser } from "../lib/admin-user";
import { assignRoles } from "../lib/roles";

const CONTRIBUTOR_NAME = "Test Contributor";

async function main(): Promise<void> {
  const email = process.env.SEED_CONTRIBUTOR_EMAIL;
  const password = process.env.SEED_CONTRIBUTOR_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_CONTRIBUTOR_EMAIL / SEED_CONTRIBUTOR_PASSWORD must be set (gitignored .env.local).",
    );
  }

  const { userId, created } = await provisionUser({
    email,
    password,
    name: CONTRIBUTOR_NAME,
  });
  await assignRoles({
    userId,
    name: CONTRIBUTOR_NAME,
    roles: ["contributor"],
  });

  console.log(
    created
      ? `seed complete: contributor ${email} created + role 'contributor' assigned`
      : `seed complete: contributor ${email} already existed; role 'contributor' ensured`,
  );
}

main().catch((err) => {
  console.error("seed:contributor failed:", err);
  process.exit(1);
});
