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
