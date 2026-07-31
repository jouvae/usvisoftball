import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Layer A — optimistic redirect + Supabase session-cookie refresh. NOT the
// security boundary (proxy.md L29): the real gate is the `getUser()` guard in
// `app/admin/(protected)/layout.tsx`. This exists for a fast anon redirect and to
// rotate the auth cookie on each matched request.
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // `updateSession` refreshes the auth cookie (side effect of getUser) and
  // returns the cookie-synced response we MUST return to keep cookies in sync.
  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/admin") &&
    pathname !== "/admin/login" &&
    !user
  ) {
    // 307 (NextResponse.redirect default). `/admin/login` is excluded so no loop.
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return response;
}

// Scope the proxy to the admin surface only — the public feed has no session to
// refresh this slice. `/admin/login` is inside the subtree (its cookie refreshes)
// but excluded from the redirect above.
export const config = {
  matcher: ["/admin/:path*"],
};
