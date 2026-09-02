// Feature flags.
//
// AI draft panel (slice-09). Gated behind NEXT_PUBLIC_AI_DRAFT_ENABLED so the
// human owns whether it ships. It is NEXT_PUBLIC_ so the SAME value is legible in
// Server Components, Server Actions, AND the client nav — one flag, no drift. The
// value is inlined at build time (a static `process.env.NEXT_PUBLIC_*` read).
//
// Semantics: enabled ONLY when the value is exactly "true". Unset / anything else =
// OFF. Production (Fly) leaves it unset/false → the panel route 404s, the nav link
// is hidden, and generate/accept reject. `.env.local` sets it to "true" so dev and
// the Playwright suite (init-e2e-007) exercise the panel.
export const AI_DRAFT_ENABLED =
  process.env.NEXT_PUBLIC_AI_DRAFT_ENABLED === "true";

// Teams/players and Events are built + data-preserved but DORMANT for the MVP launch.
// Same semantics as AI_DRAFT_ENABLED: enabled ONLY when the value is exactly "true";
// unset (prod default) = OFF → the routes 404 and the nav links are hidden. The DB tables
// (teams, team_players, event_teams, events) are untouched — flip a flag to bring the
// section back with no data migration.
export const TEAMS_ENABLED =
  process.env.NEXT_PUBLIC_TEAMS_ENABLED === "true";
export const EVENTS_ENABLED =
  process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

// The Donate button (nav) links out to PayPal. Hardcoded (not env) so it survives the
// env-free Fly build, like next.config's Storage host. TODO: swap PAYPAL_DONATE_URL for
// the Federation's real PayPal donate link (paypal.me handle or hosted Donate button URL).
export const PAYPAL_DONATE_URL = "https://www.paypal.com/donate";
