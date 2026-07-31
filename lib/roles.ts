import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// The roles / profiles Data Access Layer (slice-05 §3, §4). `profiles` realizes
// the User entity; every role read here goes through the RLS-ENFORCED session
// client (profiles_self_read: id = auth.uid()), and every role WRITE goes through
// the service client as a DEFINED seed path — never a hand-written row.
//
// This module is imported BOTH by the Next.js server runtime (the dashboard, the
// 05b Server Actions) AND by the plain-Node seed runner (scripts/seed-contributor
// → assignRoles). The seed runner uses `--conditions=react-server`, under which a
// top-level `next/navigation` import crashes (React.createContext is unavailable).
// So the Next-runtime-only dependencies (`next/navigation`, `lib/auth`,
// `lib/supabase/server`) are pulled via DYNAMIC import INSIDE the functions that
// need them — keeping this module's eager graph (server-only + the admin client)
// seed-safe, exactly like `lib/articles.ts`.
// ---------------------------------------------------------------------------

export type ProfileStatus = "active" | "disabled";

export interface Profile {
  id: string;
  name: string | null;
  roles: string[];
  status: ProfileStatus;
}

interface ProfileRow {
  id: string;
  name: string | null;
  roles: string[] | null;
  status: ProfileStatus;
}

const PROFILE_COLUMNS = "id, name, roles, status";

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    // The NOT-NULL column guarantees an array; `?? []` is belt-and-suspenders.
    roles: row.roles ?? [],
    status: row.status,
  };
}

// Reads the SIGNED-IN caller's own profile row through the cookie session client
// (RLS `profiles_self_read`: id = auth.uid()). `userId` must be the caller's own
// auth id — RLS returns no row for any other id, so this only ever surfaces the
// caller's profile. Returns `null` when no visible row exists (e.g. a pre-trigger
// account whose profile was never created); a real DB/transport error THROWS.
export async function readOwnProfile(userId: string): Promise<Profile | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data == null) return null;
  return toProfile(data as ProfileRow);
}

// The role choke point the Server Actions call (slice-05 §2.2). `requireUser()`
// redirects an unauthenticated request; then we read the caller's profile through
// the RLS client and confirm ACTIVE membership of `role`. A missing profile,
// disabled account, or absent role redirects back to the dashboard — render-time
// gating is never the only boundary (RLS re-enforces at the row), but the action
// must not proceed without the role. On success the caller gets the verified
// `{ user, profile }` (redirect returns `never`, so `profile` is non-null here).
export async function requireRole(
  role: string,
): Promise<{ user: User; profile: Profile }> {
  const { requireUser } = await import("@/lib/auth");
  const { redirect } = await import("next/navigation");
  const user = await requireUser();
  const profile = await readOwnProfile(user.id);
  if (
    profile != null &&
    profile.status === "active" &&
    profile.roles.includes(role)
  ) {
    return { user, profile };
  }
  // `redirect` throws NEXT_REDIRECT (return type `never`); `return` it so this
  // function has an explicit terminating statement regardless of the dynamic import.
  return redirect("/admin");
}

// The editorial-role choke point the AI-draft Server Actions call (slice-09 §5.2). The
// AI draft panel is for contributor OR editor, so this mirrors requireRole but accepts
// EITHER editorial role. requireUser() redirects an anon request; then the caller's
// profile is read through the RLS session client and ACTIVE membership of contributor OR
// editor is confirmed. A missing/disabled/role-less profile redirects to /admin —
// render-time gating is never the only boundary (RLS re-enforces at the row), but the
// action must not proceed without an editorial role.
export async function requireEditorialRole(): Promise<{
  user: User;
  profile: Profile;
}> {
  const { requireUser } = await import("@/lib/auth");
  const { redirect } = await import("next/navigation");
  const user = await requireUser();
  const profile = await readOwnProfile(user.id);
  if (
    profile != null &&
    profile.status === "active" &&
    (profile.roles.includes("contributor") || profile.roles.includes("editor"))
  ) {
    return { user, profile };
  }
  // `redirect` throws NEXT_REDIRECT (return type `never`); `return` it so this function
  // has an explicit terminating statement regardless of the dynamic import.
  return redirect("/admin");
}

// UPSERTs the `public.profiles` row through the service client (RLS-bypassing) — a
// DEFINED seed write path, NOT an RLS bypass of someone else's data (same posture
// as createArticle's seed use of the admin client). It MUST upsert, not bare
// UPDATE: the slice-04 admin was created BEFORE the handle_new_user trigger existed,
// so it has NO profile row — a bare UPDATE would heal 0 rows and assign nothing.
// Idempotent. `name` is written only when supplied, so a re-run can set roles
// without clobbering an existing name.
export async function assignRoles({
  userId,
  name,
  roles,
}: {
  userId: string;
  name?: string;
  roles: string[];
}): Promise<void> {
  const supabase = createAdminClient();
  const row: { id: string; roles: string[]; name?: string } = {
    id: userId,
    roles,
  };
  if (name !== undefined) {
    row.name = name;
  }
  const { error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "id" });

  if (error) throw error;
}
