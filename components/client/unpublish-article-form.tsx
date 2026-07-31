"use client";

import { useActionState } from "react";
import type { UnpublishArticleState } from "@/app/admin/(protected)/review/[id]/actions";

// The unpublish island (slice-08 §4). A button-only twin of PublishArticleForm: a
// thin `<form action>` wrapper around the id-bound `unpublishArticle` Server Action
// (passed in as `action` — the review page binds the id server-side so it is a
// closure reference, not a forgeable field). Unpublish carries NO body, so there is
// no `<textarea>`; the single Unpublish button submits an empty form. `useActionState`
// tracks pending + surfaces the returned error. On success the action revalidates
// this route, so the status badge re-renders to Unpublished in the same response — no
// client state to manage. Gold is NOT used (no CTA in the admin) — the Unpublish
// button is navy-on-white per DESIGN.md.
export function UnpublishArticleForm({
  action,
  className = "",
}: {
  action: (
    prevState: UnpublishArticleState,
  ) => Promise<UnpublishArticleState>;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<UnpublishArticleState>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className={`flex flex-col gap-4 ${className}`}>
      {state?.error ? (
        <p data-testid="unpublish-article-error" className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid="unpublish-article"
        className="w-fit rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60"
      >
        {pending ? "Unpublishing…" : "Unpublish"}
      </button>
    </form>
  );
}
