"use client";

import { useActionState, useState } from "react";
import { AI_SOURCES } from "@/lib/ai-sources";
import {
  generateAiDraft,
  acceptAiDraft,
  type GenerateAiDraftState,
  type AcceptAiDraftState,
} from "@/app/admin/(protected)/news/ai/actions";

// The AI draft panel island (slice-09 §5.5). State machine:
//   idle → generating → generated → (accept | discard)
// Generate uses useActionState(generateAiDraft): `pending` is the GENERATING state; a
// returned { ok:true, … } is the GENERATED state (renders the review area); { ok:false,
// error } renders ai-error. Accept posts source+prompt as HIDDEN inputs to acceptAiDraft,
// which re-derives + persists server-side then redirects (no client success branch).
// Discard is a client-only reset to idle (no DB touch). dangerouslySetInnerHTML is BANNED
// on the generated body — AI-authored input is rendered as React-escaped text. Gold is
// NOT used (no CTA in the admin) — navy-on-white primary buttons per DESIGN.md.
export function AiDraftPanel({ className = "" }: { className?: string }) {
  const [state, generateAction, generating] = useActionState<
    GenerateAiDraftState,
    FormData
  >(generateAiDraft, undefined);

  const [, acceptAction, accepting] = useActionState<
    AcceptAiDraftState,
    FormData
  >(acceptAiDraft, undefined);

  // Client-only "discarded" flag gating the review area, reset whenever a new draft is
  // generated. A discard returns the panel to idle without touching the DB.
  const [discarded, setDiscarded] = useState(false);

  const generated = state?.ok === true ? state : null;
  const showReview = generated != null && !discarded;

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <form
        action={(formData) => {
          setDiscarded(false);
          generateAction(formData);
        }}
        className="flex max-w-2xl flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Owned or licensed source
          <select
            name="source"
            required
            defaultValue={AI_SOURCES[0]?.value ?? ""}
            data-testid="ai-source-select"
            className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
          >
            {AI_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Prompt
          <textarea
            name="prompt"
            required
            rows={4}
            data-testid="ai-prompt"
            className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
          />
        </label>

        {state?.ok === false ? (
          <p data-testid="ai-error" className="text-sm text-muted">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={generating}
          data-testid="ai-generate"
          className="w-fit rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60"
        >
          {generating ? "Generating…" : "Generate draft"}
        </button>
      </form>

      {showReview ? (
        <div
          data-testid="ai-generated-draft"
          className="flex max-w-2xl flex-col gap-4 rounded-lg border border-border p-4"
        >
          <h2
            data-testid="ai-generated-title"
            className="font-display text-2xl font-semibold text-brand"
          >
            {generated.title}
          </h2>

          {/* React-escaped text — dangerouslySetInnerHTML stays banned on AI-authored
              content (slice-09 §5.5). */}
          <p
            data-testid="ai-generated-body"
            className="whitespace-pre-wrap text-muted"
          >
            {generated.body}
          </p>

          <p data-testid="ai-provenance" className="text-sm text-muted">
            Source: {generated.sourceLabel} · Model:{" "}
            {generated.aiProvenance.model}
          </p>

          <div className="flex flex-wrap gap-3">
            <form action={acceptAction}>
              <input type="hidden" name="source" value={generated.source} />
              <input type="hidden" name="prompt" value={generated.prompt} />
              <button
                type="submit"
                disabled={accepting}
                data-testid="ai-accept"
                className="rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60"
              >
                {accepting ? "Saving…" : "Accept draft"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setDiscarded(true)}
              data-testid="ai-discard"
              className="rounded-md border border-border px-4 py-2 font-medium text-brand outline-focus hover:bg-surface focus:outline-2"
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
