import "server-only"; // never reaches a Client Component
import type { AiProvenance } from "@/lib/articles";

// The deterministic STUB drafter (slice-09 §3) — the ONE swap-in seam for the real
// Claude call. Pure + deterministic: same (source, prompt) ⇒ byte-for-byte the same
// { title, body, aiProvenance }. Title/body are DERIVED from source+prompt by string
// composition with ZERO randomness — no Math.random, no Date.now, no new Date(). This is
// deliberate: it keeps the e2e deterministic (status.md: "CI and local agree exactly"),
// AND it is what lets acceptAiDraft RE-DERIVE the persisted content server-side (§5.4)
// rather than trust a client-submitted body (a well-formed POST is untrusted —
// server-actions.md §Security).

export interface GenerateDraftInput {
  source: string;
  prompt: string;
}

export interface GeneratedDraft {
  title: string;
  body: string;
  aiProvenance: AiProvenance;
}

// generateDraft — deterministic stub.
//
// MINOR-1: the generated `title` MUST embed the caller's `prompt` VERBATIM. The e2e sets
// the prompt to a unique `[e2e-007] <uuid>` marker and finds/cleans the row by a
// CONTAINS-match on the title, so the exact prompt string is spliced mid-title here.
//
// ⭐ THE SWAP-IN SEAM: the real version keeps this exact signature, calls `claude-*`, and
// sets `model` to the real model id (e.g. 'claude-sonnet-4-…'). No other call site
// changes. No network, no API key, no @anthropic-ai SDK in the prototype. model:'stub' is
// the provenance marker.
export function generateDraft({
  source,
  prompt,
}: GenerateDraftInput): GeneratedDraft {
  const title = `Federation report: ${prompt}`;
  const body = [
    `An AI-assisted draft prepared from the "${source}" source.`,
    ``,
    `Brief: ${prompt}`,
    ``,
    `This draft is generated for human editorial review and has not been ` +
      `published. An editor must review and publish it through the normal ` +
      `workflow before it appears on the public feed.`,
  ].join("\n");

  return {
    title,
    body,
    aiProvenance: { source, model: "stub" },
  };
}
