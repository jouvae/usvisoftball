"use client";

import { useActionState } from "react";
import {
  rollBoardTermAction,
  type RollTermActionState,
} from "@/app/admin/(protected)/board/actions";

// The term-rollover island (about-e2e-006). A thin `<form action>` around
// `rollBoardTermAction`: the editor names the new term (slug + label); the action
// archives the outgoing current term and creates the new one WITHOUT touching the prior
// roster (permanence by construction — lib/board.rollBoardTerm). `useActionState` tracks
// pending + surfaces the returned error. On success the action revalidates /about + this
// screen. Navy-on-white per DESIGN.md.
export function RollTermForm({ className = "" }: { className?: string }) {
  const [state, formAction, pending] = useActionState<
    RollTermActionState,
    FormData
  >(rollBoardTermAction, undefined);

  return (
    <form
      action={formAction}
      data-testid="roll-term-form"
      className={`flex flex-col gap-3 ${className}`}
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        New term slug
        <input
          type="text"
          name="newSlug"
          required
          placeholder="2027-2029"
          data-testid="roll-term-slug"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        New term label
        <input
          type="text"
          name="newLabel"
          required
          placeholder="2027–2029"
          data-testid="roll-term-label"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      {state?.error ? (
        <p data-testid="roll-term-error" className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid="roll-term-submit"
        className="w-fit rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60"
      >
        {pending ? "Rolling…" : "Roll to new term"}
      </button>
    </form>
  );
}
