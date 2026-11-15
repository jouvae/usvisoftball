import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { homeForRoles, isScoringPath } from "@/lib/roles-view";
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
  const { response, user, supabase } = await updateSession(request);

  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/admin") &&
    pathname !== "/admin/login" &&
    !user
  ) {
    // 307 (NextResponse.redirect default). `/admin/login` is excluded so no loop.
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // Scorekeeper confinement (schedule overview §6.1): a user whose roles grant ONLY scoring
  // is sent to /admin/scoring from ANY other admin path (incl. the page-ungated
  // /admin/articles/new). Done here, at the HTTP level, because it then covers full loads,
  // client-side (RSC) navigations and Server-Action redirects alike — a redirect thrown from
  // the shared admin LAYOUT does not: layouts don't re-render on navigation (layout.md
  // §"Pathname"), and one thrown mid-navigation left the router in a refetch loop. Not the
  // only gate: each section's page / Server Actions still check roles, and RLS enforces at
  // the row. Scoring paths skip the extra profile read (every scoring tap posts there).
  // `/admin` itself is left to the dashboard PAGE's own redirect: the sign-in Server Action
  // redirects there and Next renders that target through this proxy inside the action
  // response — a proxy redirect at that point strands the client on a blank /admin, while a
  // page-level redirect() is followed correctly.
  if (user && pathname !== "/admin/login" && pathname !== "/admin" && !isScoringPath(pathname)) {
    const { data, error } = await supabase
      .from("profiles")
      .select("roles,status")
      .eq("id", user.id)
      .maybeSingle();
    const profile = data as { roles: string[] | null; status: string } | null;
    // Fail open on a read error: the page-level gates still apply.
    if (!error && profile?.status === "active" && homeForRoles(profile.roles ?? []) === "/admin/scoring") {
      const redirect = NextResponse.redirect(new URL("/admin/scoring", request.url));
      // Carry any rotated auth cookies onto the redirect.
      for (const c of response.cookies.getAll()) redirect.cookies.set(c);
      return redirect;
    }
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
