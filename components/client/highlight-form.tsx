"use client";

import { useActionState } from "react";
// ANTI-LEAK: client-safe values come from the view module, never from "@/lib/feed" (server-only).
import { HIGHLIGHT_TEXT_MAX, type ManualHighlight } from "@/lib/feed-view";
import type { HighlightActionState } from "@/app/admin/(protected)/highlights/actions";

const inputClass =
  "rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2";
const labelClass = "flex flex-col gap-1 text-sm font-medium text-foreground";
const hintClass = "text-xs font-normal text-muted";

// The manual-highlight form island (home-feed H7). One island for add and edit — the StatForm
// pattern: the caller passes an id-bound `action`, the mode's testids, and (for edit) the row.
export function HighlightForm({
  action,
  highlight,
  formTestId,
  submitTestId,
  submitLabel,
  errorTestId,
}: {
  action: (prev: HighlightActionState, formData: FormData) => Promise<HighlightActionState>;
  highlight?: ManualHighlight;
  formTestId: string;
  submitTestId: string;
  submitLabel: string;
  errorTestId: string;
}) {
  const [state, formAction, pending] = useActionState<HighlightActionState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} data-testid={formTestId} className="grid gap-3 sm:grid-cols-2">
      <label className={labelClass}>
        English
        <span className={hintClass}>One or two short lines — “USVI clinch a semifinal spot.”</span>
        <textarea
          name="textEn"
          required
          rows={3}
          maxLength={HIGHLIGHT_TEXT_MAX}
          defaultValue={highlight?.textEn ?? ""}
          data-testid="highlight-text-en"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Spanish
        <span className={hintClass}>Shown on the Spanish site (/es)</span>
        <textarea
          name="textEs"
          required
          rows={3}
          maxLength={HIGHLIGHT_TEXT_MAX}
          defaultValue={highlight?.textEs ?? ""}
          data-testid="highlight-text-es"
          className={inputClass}
        />
      </label>

      <label className={`${labelClass} sm:col-span-2`}>
        Link (optional)
        <span className={hintClass}>https://… for a press story, or a site path like /events/…</span>
        <input
          type="text"
          name="linkUrl"
          defaultValue={highlight?.linkUrl ?? ""}
          data-testid="highlight-link-url"
          className={inputClass}
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-foreground sm:col-span-2">
        <input
          type="checkbox"
          name="isPublished"
          value="1"
          defaultChecked={highlight?.isPublished ?? true}
          data-testid="highlight-published"
        />
        Show on the home page
      </label>

      {state?.error ? (
        <p data-testid={errorTestId} className="text-sm text-muted sm:col-span-2">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid={submitTestId}
        className="w-fit rounded-md bg-brand px-4 py-2 font-medium text-brand-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60 sm:col-span-2"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
