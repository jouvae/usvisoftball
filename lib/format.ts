// Pure, dependency-free helpers. Deliberately UNFENCED (no `server-only`).

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
