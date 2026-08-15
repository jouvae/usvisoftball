"use client";

import { useActionState } from "react";
import type {
  CommitteeActionState,
  CommitteeMemberActionState,
} from "@/app/admin/(protected)/committees/actions";

// The committee/member delete island (about-e2e-012/013). A thin `<form action>` around an
// id-bound delete action (the page binds the id server-side, so the island never carries a
// forgeable id). ONE island serves BOTH the committee delete and the member delete via the
// passed testids + label. `useActionState` tracks pending + surfaces the returned error; on
// success the action revalidates this route so the list re-renders in the same response.
// Navy-on-white per DESIGN.md.
type DeleteState = CommitteeActionState | CommitteeMemberActionState;

export function CommitteeDeleteButton({
  action,
  testId,
  errorTestId,
  label,
  className = "",
}: {
  action: (
    prevState: DeleteState,
    formData: FormData,
  ) => Promise<DeleteState>;
  testId: string;
  errorTestId: string;
  label: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<DeleteState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className={`flex flex-col gap-2 ${className}`}>
      <button
        type="submit"
        disabled={pending}
        data-testid={testId}
        className="w-fit rounded-md border border-border px-3 py-1.5 text-sm font-medium text-brand outline-focus hover:bg-surface focus:outline-2 disabled:opacity-60"
      >
        {pending ? "Removing…" : label}
      </button>
      {state?.error ? (
        <p data-testid={errorTestId} className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
