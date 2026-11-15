import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import {
  LOCALE_HEADER,
  hasLocalePrefix,
  stripLocale,
} from "@/lib/i18n/locale";

// Paths that are never localized: the admin surface (English-only) and API routes.
function isUnlocalized(path: string): boolean {
  return /^\/(admin|api)(\/|$)/.test(path);
}

// Locale routing (schedule overview §4, D9). Spanish lives under /es…: the request is REWRITTEN
// to the unprefixed internal route (the browser keeps /es…) with `x-locale: es`; every other
// public request gets `x-locale: en`. The header is always overwritten, so a client-sent
// x-locale can't flip the language. No Accept-Language redirect — crawlers must see stable URLs.
function localeResponse(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  const internal = stripLocale(pathname);

  if (hasLocalePrefix(pathname) && !isUnlocalized(internal)) {
    requestHeaders.set(LOCALE_HEADER, "es");
    const url = request.nextUrl.clone();
    url.pathname = internal;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  requestHeaders.set(LOCALE_HEADER, "en");
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Layer A — optimistic redirect + Supabase session-cookie refresh. NOT the
// security boundary (proxy.md L29): the real gate is the `getUser()` guard in
// `app/admin/(protected)/layout.tsx`. This exists for a fast anon redirect and to
// rotate the auth cookie on each matched request.
async function adminResponse(request: NextRequest): Promise<NextResponse> {
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

// The admin subtree keeps its session branch exactly as before (the public site has no session
// to refresh, so it never pays the getUser() round-trip); everything else is locale routing.
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return adminResponse(request);
  }
  return localeResponse(request);
}

// Every page request — the admin surface plus the public site — but never Next internals,
// API routes, the favicon, or static files (anything whose last segment has an extension).
export const config = {
  matcher: ["/((?!_next/|api/|favicon\\.ico$|.*\\.[^/]+$).*)"],
};
