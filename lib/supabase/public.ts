import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The RLS-ENFORCED client. Runs as the `anon` Supabase role via the publishable
// key. This is the client the public feed reads through (slice-02 §2.3): under the
// `articles_public_read_published` policy it can see ONLY published rows, so the
// feed genuinely exercises RLS — a broken policy shows an empty feed rather than
// being masked by a bypassing key.
//
// Unfenced: it touches only NEXT_PUBLIC_-prefixed vars, so it is browser-safe.
export function createPublicClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
