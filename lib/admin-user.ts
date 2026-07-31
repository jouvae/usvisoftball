import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// The ONLY sanctioned auth-user create path — NEVER hand-write an `auth.users`
// row. `email_confirm: true` yields a confirmed user so `signInWithPassword` works
// immediately with no email inbox (deterministic for Playwright). `user_metadata:
// { name }` is what the 0003 `handle_new_user` trigger reads into `profiles.name`,
// which later surfaces as the article byline — so the display name flows from ONE
// place (the seed) through the trigger.
//
// Idempotent: a second run raises an "email exists" error from the Auth API; we
// catch THAT narrowly (treat as already-provisioned), look the existing user's id
// up by email so the caller can still assign roles, and re-throw anything else —
// same discipline as `scripts/seed-articles.ts`'s narrow `23505` catch.
export async function provisionUser({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name: string;
}): Promise<{ userId: string; created: boolean }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error) {
    const message = (error.message ?? "").toLowerCase();
    const alreadyExists =
      message.includes("already been registered") ||
      message.includes("already registered") ||
      message.includes("already exists");
    if (alreadyExists) {
      const userId = await findUserIdByEmail(supabase, email);
      if (!userId) {
        // The API said the email exists but we cannot resolve its id — fail loudly
        // rather than pretend success (the seed relies on this id for assignRoles).
        throw error;
      }
      return { userId, created: false };
    }
    throw error;
  }

  if (!data.user) {
    throw new Error("createUser returned no user");
  }
  return { userId: data.user.id, created: true };
}

// Backward-compatible wrapper (slice-04 seed contract): provisions an admin user
// without a display name concern at the call site. Retained so the slice-04 shape
// (`provisionAdminUser({ email, password })`) keeps working; new callers use
// `provisionUser` directly to obtain the id for role assignment.
export async function provisionAdminUser({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<{ userId: string; created: boolean }> {
  return provisionUser({ email, password, name: "Admin" });
}

// Resolves an existing user's auth id by email via the admin listUsers pagination.
// Seeds provision a handful of users, so a bounded page walk is more than enough;
// there is no admin "get by email" primitive in auth-js.
async function findUserIdByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const match = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === target,
    );
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
}
