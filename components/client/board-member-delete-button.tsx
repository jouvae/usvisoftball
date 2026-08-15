"use client";

import { useActionState } from "react";
import type { DeleteMemberActionState } from "@/app/admin/(protected)/board/actions";

// The delete-member island (about-e2e-005). A thin `<form action>` around the id-bound
// `deleteBoardMemberAction` (the roster page binds the member id server-side, so the
// island never carries a forgeable id). `useActionState` tracks pending + surfaces the
// returned error. On success the action revalidates this route, so the roster
// re-renders without the member in the same response. Navy-on-white per DESIGN.md.
export function BoardMemberDeleteButton({
  action,
  className = "",
}: {
  action: (
    prevState: DeleteMemberActionState,
    formData: FormData,
  ) => Promise<DeleteMemberActionState>;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<
    DeleteMemberActionState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className={`flex flex-col gap-2 ${className}`}>
      <button
        type="submit"
        disabled={pending}
        data-testid="member-delete"
        className="w-fit rounded-md border border-border px-3 py-1.5 text-sm font-medium text-brand outline-focus hover:bg-surface focus:outline-2 disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state?.error ? (
        <p data-testid="member-delete-error" className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
