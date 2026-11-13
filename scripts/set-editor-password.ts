// Give an EXISTING account a fresh random password so its owner can sign in at
// /admin/login. For editors whose invite was never completed: the app has no
// set-password page, so a Supabase invite link can't be finished.
//
// Usage (run it in YOUR OWN terminal, not through an assistant or a CI log — the
// password is printed once, to stdout):
//   node --conditions=react-server --env-file=.env.local --import tsx \
//     scripts/set-editor-password.ts <email>
//
// Uses the service-role admin API: looks the user up by email, sets the password,
// and confirms the email (an unaccepted invite leaves it unconfirmed, which blocks
// password sign-in). Never creates a user and never changes roles — use
// provision-editor.ts for a new editor.
import { randomBytes } from "node:crypto";
import { createAdminClient } from "../lib/supabase/admin";

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("usage: set-editor-password.ts <email>");

  const supabase = createAdminClient();

  // listUsers is paginated; the federation has a handful of accounts, so scan pages.
  let userId: string | null = null;
  for (let page = 1; !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }
  if (!userId) throw new Error(`no account for ${email}`);

  const password = randomBytes(18).toString("base64url");
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (error) throw error;

  console.log(`Password set for ${email}. Sign in at /admin/login with:\n\n  ${password}\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
