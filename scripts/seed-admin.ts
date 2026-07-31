// Canonical seed for the operator admin user (slice-04 §6, extended in slice-05 §4).
//
// Goes through the ONE sanctioned create path — `provisionUser()` →
// `auth.admin.createUser({ email_confirm: true, user_metadata: { name } })` — and
// NOTHING else. Never a raw `auth.users` insert. After provisioning, `assignRoles`
// UPSERTS the profile with the `editor` role: the upsert both HEALS the pre-trigger
// admin's missing `profiles` row (it was created before the 0003 handle_new_user
// trigger existed) AND assigns the role slices 06/07 gate on.
//
// Idempotent: a re-run hits an "email exists" error, which `provisionUser` treats
// as already-provisioned (resolving the existing id so roles can still be set). Any
// OTHER error is fatal — we fail loudly (non-zero exit), mirroring
// `scripts/seed-articles.ts`.
//
// Relative imports (not `@/…`) so the standalone runner resolves cleanly.
import { provisionUser } from "../lib/admin-user";
import { assignRoles } from "../lib/roles";

const ADMIN_NAME = "Admin";

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set (gitignored .env.local).",
    );
  }

  const { userId, created } = await provisionUser({
    email,
    password,
    name: ADMIN_NAME,
  });
  await assignRoles({ userId, name: ADMIN_NAME, roles: ["editor"] });

  console.log(
    created
      ? `seed complete: admin ${email} created + role 'editor' assigned`
      : `seed complete: admin ${email} already existed; role 'editor' ensured`,
  );
}

main().catch((err) => {
  console.error("seed:admin failed:", err);
  process.exit(1);
});
