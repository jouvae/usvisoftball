"use client";

import { useActionState } from "react";
import type { Committee } from "@/lib/committees";
import type { CommitteeActionState } from "@/app/admin/(protected)/committees/actions";

// The committee form island (about-e2e-012). ONE island serves BOTH add and edit: the
// caller passes an id-bound `action`, the mode-specific testids, and (for edit) a
// `committee` to prefill. `useActionState` tracks pending + surfaces the returned error.
// On success the action revalidates this route, so the list re-renders in the same
// response — no client state to manage. Navy-on-white per DESIGN.md; no gold, no
// dangerouslySetInnerHTML.
export function CommitteeForm({
  action,
  committee,
  formTestId,
  submitTestId,
  submitLabel,
  errorTestId,
  className = "",
}: {
  action: (
    prevState: CommitteeActionState,
    formData: FormData,
  ) => Promise<CommitteeActionState>;
  committee?: Committee;
  formTestId: string;
  submitTestId: string;
  submitLabel: string;
  errorTestId: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<
    CommitteeActionState,
    FormData
  >(action, undefined);

  return (
    <form
      action={formAction}
      data-testid={formTestId}
      className={`flex flex-col gap-3 ${className}`}
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Name
        <input
          type="text"
          name="name"
          required
          defaultValue={committee?.name ?? ""}
          data-testid="committee-name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Description
        <textarea
          name="description"
          rows={3}
          defaultValue={committee?.description ?? ""}
          data-testid="committee-description"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Sort order
        <input
          type="number"
          name="sortOrder"
          defaultValue={committee?.sortOrder ?? 0}
          data-testid="committee-sort"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      {state?.error ? (
        <p data-testid={errorTestId} className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid={submitTestId}
        className="w-fit rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
