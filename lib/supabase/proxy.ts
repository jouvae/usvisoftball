import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import WebSocketImpl from "ws";

// supabase-js eagerly constructs a RealtimeClient, which needs a WebSocket
// constructor at construction time. The proxy runs on the Node.js runtime
// (proxy.md L221), where Node < 22 has no global `WebSocket`, so the constructor
// throws before any query runs. We never use realtime, but must satisfy the
// constructor — same shim as `lib/supabase/admin.ts`. Verified empirically: the
// proxy runtime does NOT polyfill `WebSocket`, so this is required.
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocketImpl;
}

// `updateSession` is the Supabase SSR canonical proxy helper: it builds a cookie
// client bound to the NextRequest/NextResponse cookie API, calls `getUser()` (a
// network round-trip that also REFRESHES the auth cookie as a side effect), and
// returns the cookie-synced response together with the user. Returning THIS exact
// response keeps the rotated auth cookies in sync. Uses the publishable/anon key.
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: { id: string } | null;
}> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
