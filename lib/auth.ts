import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The Data Access Layer choke point — THE security boundary for `/admin`.
//
// Uses `getUser()` (NOT `getSession()`): `getUser()` issues a network request to
// the Supabase Auth server that RE-VALIDATES the JWT, so a forged/expired cookie
// fails here. `getSession()` reads the JWT straight from the cookie and its own
// docstring warns the user "must not be trusted" on an insecure medium.
//
// Called as the FIRST statement of the protected admin layout, before any child
// renders — an anon request is redirected (307) and nothing downstream executes,
// so no admin data is ever serialized.
export async function requireUser(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return user;
}
