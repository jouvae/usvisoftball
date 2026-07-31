import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocketImpl from "ws";

// supabase-js eagerly constructs a RealtimeClient, which needs a WebSocket
// constructor at construction time. Node < 22 has no global `WebSocket`, so a
// plain-Node runtime (the seed script, the Playwright worker) throws before any
// query runs. We never use realtime, but we must satisfy the constructor. This
// module is `server-only`, so pulling the Node-only `ws` package is safe (it is
// never in the browser bundle). The guard leaves the Next.js server runtime —
// which already polyfills `WebSocket` via undici — untouched.
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocketImpl;
}

// The RLS-BYPASSING client. Runs as `service_role` via the full-access secret key
// (SUPABASE_KEY, the new-format `sb_secret_…`). Writing/deleting an article is not
// a public capability, so this client must bypass the read-only public policy
// (slice-02 §2.3).
//
// FENCED with `import "server-only"`: this secret must NEVER reach a Client
// Component. Any accidental client import becomes a build error
// (05-server-and-client-components.md §"Preventing environment poisoning"). Only
// used by `createArticle` / `deleteAllArticles` and the seed script.
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_KEY; // sb_secret_… — full access, RLS-bypassing.
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
