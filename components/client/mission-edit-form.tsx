"use client";

import { useActionState } from "react";
import {
  updateMissionAction,
  type MissionActionState,
} from "@/app/admin/(protected)/board/actions";

// The mission edit island (about-e2e-004). A thin `<form action>` around
// `updateMissionAction`. The body `<textarea>` is prefilled with the current mission
// prose (defaultValue) so the editor edits in place. `useActionState` tracks pending +
// surfaces the returned error. On success the action revalidates /about + this screen,
// so the fresh copy renders in the same response. Navy-on-white per DESIGN.md.
export function MissionEditForm({
  defaultBody,
  className = "",
}: {
  defaultBody: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<
    MissionActionState,
    FormData
  >(updateMissionAction, undefined);

  return (
    <form
      action={formAction}
      data-testid="mission-form"
      className={`flex flex-col gap-3 ${className}`}
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Mission statement
        <textarea
          name="body"
          rows={6}
          defaultValue={defaultBody}
          data-testid="mission-body"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      {state?.error ? (
        <p data-testid="mission-error" className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid="mission-save"
        className="w-fit rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save mission"}
      </button>
    </form>
  );
}
