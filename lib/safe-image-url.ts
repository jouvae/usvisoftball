// Shared, CLIENT-SAFE render-time guard for stored image URLs (board/committee/team/player
// photos + team/event logos). SINGLE SOURCE OF TRUTH — teams-view (safePhotoHref /
// safeLogoHref) and events-view (safeEventLogoHref) both delegate here so the write/render
// parity can never drift (red-team-interactive Medium: a host-blind copy let an off-site
// https URL whose PATH matched the storage prefix render as a live <img src>).
//
// Returns the URL to use as an <img src> ONLY if it is:
//   - a local /public path — a single leading '/', with the next char NOT '/' or '\' (the
//     URL parser resolves '/\host' and '//host' off-origin), or
//   - an https URL on THIS project's Supabase Storage host AND under the board-photos public
//     object path.
// Everything else (javascript:/data:/other schemes, off-site hosts, other buckets,
// protocol-relative, unparseable) → ''.
//
// The Storage host is HARDCODED (not read from env) so the guard is correct in the Fly
// offline build, which has no env — and it matches the pinned host in next.config.ts
// (images.remotePatterns). It is the PUBLIC project ref (ships in NEXT_PUBLIC_SUPABASE_URL
// to every browser), not a secret. If the Supabase project changes, update BOTH this
// constant and next.config.ts to match NEXT_PUBLIC_SUPABASE_URL.
const STORAGE_HOST = "miiyxrjfvzrcryludqcj.supabase.co";
const STORAGE_PATH_PREFIX = "/storage/v1/object/public/board-photos/";

export function safeStoredImageHref(url: string): string {
  if (!url) return "";
  if (/^\/(?![/\\])/.test(url)) return url; // local /public path
  try {
    const u = new URL(url);
    return u.protocol === "https:" &&
      u.host === STORAGE_HOST &&
      u.pathname.startsWith(STORAGE_PATH_PREFIX)
      ? url
      : "";
  } catch {
    return "";
  }
}
