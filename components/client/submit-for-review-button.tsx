"use client";

import { useActionState } from "react";
import type { SubmitForReviewState } from "@/app/admin/(protected)/articles/[id]/actions";

// The submit-for-review island (slice-05 §3). A thin `<form action>` wrapper around
// the id-bound `submitForReview` Server Action (passed in as `action` — the editor
// page binds the id server-side so it is a closure reference, not a forgeable
// field). `useActionState` tracks pending + surfaces the returned error. On success
// the action revalidates this route, so the editor's status badge re-renders to
// `in_review` in the same response — no client state to manage.
export function SubmitForReviewButton({
  action,
  className = "",
}: {
  action: (
    prevState: SubmitForReviewState,
    formData: FormData,
  ) => Promise<SubmitForReviewState>;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<
    SubmitForReviewState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className={`flex flex-col gap-2 ${className}`}>
      <button
        type="submit"
        disabled={pending}
        data-testid="submit-for-review"
        className="w-fit rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit for review"}
      </button>
      {state?.error ? (
        <p data-testid="submit-for-review-error" className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
