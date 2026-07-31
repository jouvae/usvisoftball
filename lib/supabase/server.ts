import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// The COOKIE-BACKED, RLS-ENFORCED session client. Runs as the end user via their
// cookie JWT (publishable/anon key — NEVER the service key). This is the client
// the `/admin` guard and the sign-in action read/write the session through.
//
// FENCED with `import "server-only"`: it binds to `next/headers` cookies and must
// never reach a Client Component.
//
// The `setAll` try/catch is required: during a Server Component render `cookies()`
// is read-only and `set` throws — that write is a no-op there (the proxy persists
// the refreshed cookie instead). In a Server Action (login) `cookies()` is
// writable, so `setAll` persists the freshly-issued session.
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Read-only cookie store during an RSC render — the proxy persists the
          // refreshed session cookie instead.
        }
      },
    },
  });
}
