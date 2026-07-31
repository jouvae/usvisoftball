import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// The browser-side cookie session client (publishable/anon key). NOT on this
// slice's sign-in path — sign-in is a Server Action — but defined for the
// contract and future client-side session reads. Browser-safe: it touches only
// NEXT_PUBLIC_-prefixed vars.
export function createSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return createBrowserClient(url, key);
}
