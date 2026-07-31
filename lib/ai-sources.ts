// Placeholder owned/licensed source allow-list (slice-09 §0.2 — the Federation still owes
// the real list; recorded as prototype debt §8). Kept in a PLAIN module (no server-only
// fence, no 'use server') because it is shared by BOTH the client island (which renders
// the <select> options) and the Server Actions (which validate submitted FormData against
// it) — a "use server" module may only export async functions, so the list cannot live
// there. The single source of truth for the placeholder sources.

export interface AiSource {
  value: string;
  label: string;
}

export const AI_SOURCES: ReadonlyArray<AiSource> = [
  { value: "federation-wire", label: "Federation Wire (licensed)" },
  { value: "league-press-pool", label: "League Press Pool (owned)" },
  { value: "club-media-desk", label: "Club Media Desk (owned)" },
] as const;

export function sourceLabel(value: string): string | null {
  return AI_SOURCES.find((s) => s.value === value)?.label ?? null;
}
