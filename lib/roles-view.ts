// Client-safe role helpers (no `server-only`) — schedule S4, overview §6.1.

// The admin home a signed-in user lands on. Returns '/admin/scoring' when the user's
// roles grant ONLY scoring access (they hold `scorekeeper` and neither `editor` nor
// `contributor`), else '/admin'. Used by the /admin dashboard to redirect a
// scorekeeper-only user, by other admin sections to bounce them back, and by the admin
// nav to show only "Scoring". Pure: decides on the passed role list alone (the caller is
// responsible for having read an ACTIVE profile).
export function homeForRoles(roles: readonly string[]): "/admin/scoring" | "/admin" {
  const scoringOnly =
    roles.includes("scorekeeper") && !roles.includes("editor") && !roles.includes("contributor");
  return scoringOnly ? "/admin/scoring" : "/admin";
}

// True when `pathname` is inside the scoring area (/admin/scoring or below).
export function isScoringPath(pathname: string): boolean {
  return pathname === "/admin/scoring" || pathname.startsWith("/admin/scoring/");
}
