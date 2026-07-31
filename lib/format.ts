// Pure, dependency-free date formatting. Deliberately UNFENCED (no `server-only`)
// so a future Client Component can reuse it (slice-02 §2 module inventory, n2).
//
// Deterministic by construction: formats straight off the ISO string using UTC
// getters + a hardcoded month array. It never calls `toLocaleDateString()` and
// never depends on the runtime's default timezone, so CI and local agree exactly
// (slice-02 §3.3). Output shape: "June 20, 2026".

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function formatArticleDate(iso: string): string {
  const d = new Date(iso);
  const month = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

// Derive a URL slug from a title (slice-05 §2.2). Pure + deterministic:
// lowercase, non-alphanumerics → hyphens, collapse + trim runs. No collision
// strategy beyond the DB unique constraint (a duplicate raises 23505, surfaced as
// a form error — recorded as prototype debt in slice-05 §8).
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
