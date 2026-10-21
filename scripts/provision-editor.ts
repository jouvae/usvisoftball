// Provision a REAL editor via the invite flow (no password ever transits any channel).
//
// Usage:  node --conditions=react-server --env-file=.env.local --import tsx \
//           scripts/provision-editor.ts <email> "<Display Name>"
//
// Goes through the sanctioned admin path: `auth.admin.inviteUserByEmail(email, {
// data: { name } })` sends a Supabase invite email whose link lets the person set
// their OWN password (and confirms their email on acceptance). `data.name` becomes
// user_metadata → the 0003 handle_new_user trigger writes profiles.name (the byline).
// After the invite creates the auth user, `assignRoles` UPSERTS the `editor` role.
//
// Idempotent-ish: if the email is already registered, we DON'T silently succeed —
// inviteUserByEmail errors, and we surface it so the operator decides (re-invite vs
// password-recovery is a different flow). Never a raw auth.users insert.
import { createAdminClient } from "../lib/supabase/admin";
import { assignRoles } from "../lib/roles";

async function main(): Promise<void> {
  const email = process.argv[2];
  const name = process.argv[3];
  if (!email || !name) {
    throw new Error('usage: provision-editor.ts <email> "<Display Name>"');
  }

  const supabase = createAdminClient();

  // inviteUserByEmail SENDS the invite email (requires the project's auth email/SMTP to
  // be working). It both creates the user and dispatches the link — so a send failure
  // surfaces as an error here rather than a silent half-provisioned account.
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name },
  });
  if (error) {
    throw new Error(`invite failed for ${email}: ${error.message}`);
  }
  if (!data.user) {
    throw new Error(`invite returned no user for ${email}`);
  }

  await assignRoles({ userId: data.user.id, name, roles: ["editor"] });

  console.log(
    `provisioned editor: ${email} (${name}) — invite email sent; role 'editor' assigned; id ${data.user.id}`,
  );
}

main().catch((err) => {
  console.error("provision-editor failed:", err);
  process.exit(1);
});
