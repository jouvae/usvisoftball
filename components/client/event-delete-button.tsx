"use client";

import { useActionState } from "react";
import type { EventActionState } from "@/app/admin/(protected)/events/actions";

// The event delete island (events-e2e-003). A thin `<form action>` around an id-bound delete
// action (the page binds the id server-side, so the island never carries a forgeable id).
// Reusable via the passed testids + label. `useActionState` tracks pending + surfaces the
// returned error; on success the action revalidates this route so the list re-renders in the
// same response. The bound action ignores the extra FormData arg. Navy-on-white per DESIGN.md.
export function EventDeleteButton({
  action,
  testId,
  errorTestId,
  label,
  className = "",
}: {
  action: (
    prevState: EventActionState,
    formData: FormData,
  ) => Promise<EventActionState>;
  testId: string;
  errorTestId: string;
  label: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<
    EventActionState,
    FormData
  >(action, undefined);

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
