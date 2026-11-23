"use client";

import { useActionState } from "react";
import type { SetHighlightState } from "@/app/admin/(protected)/review/[id]/actions";

// The "feature on the home page" toggle (MVP slice 4; since home-feed H4 the newest featured
// story is the home's lead story — the column is still `is_highlight`). A button-only twin of
// UnpublishArticleForm: a thin `<form action>` wrapper around the id+next-bound
// `setHighlight` Server Action (the review page binds BOTH the id and the desired
// next value server-side, so neither is a forgeable field). Carries no body — the
// single button submits an empty form. `isHighlight` is the CURRENT state (drives
// the label + the state line); the action flips it. `useActionState` tracks pending +
// surfaces the returned error. On success the action revalidates this route, so the
// label re-renders in the same response — no client state to manage. Navy-on-white
// per DESIGN.md (no gold CTA in the admin).
export function HighlightToggleForm({
  action,
  isHighlight,
  className = "",
}: {
  action: (prevState: SetHighlightState) => Promise<SetHighlightState>;
  isHighlight: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<SetHighlightState>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className={`flex flex-col gap-2 ${className}`}>
      {state?.error ? (
        <p data-testid="highlight-error" className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid="toggle-highlight"
        aria-pressed={isHighlight}
        className="w-fit rounded-md border border-brand bg-background px-4 py-2 font-medium text-brand outline-focus hover:bg-surface focus:outline-2 disabled:opacity-60"
      >
        {pending
          ? "Updating…"
          : isHighlight
            ? "Stop featuring on the home page"
            : "Feature on the home page"}
      </button>

      <p data-testid="highlight-state" className="text-sm text-muted">
        {isHighlight
          ? "Featured. The newest featured story is the home page's lead story."
          : "Not featured. The home page leads with the newest featured story, or the newest story."}
      </p>
    </form>
  );
}
