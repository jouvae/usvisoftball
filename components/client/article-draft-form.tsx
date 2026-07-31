"use client";

import { useActionState } from "react";
import {
  createDraft,
  type CreateDraftState,
} from "@/app/admin/(protected)/articles/new/actions";

// The new-article form island (slice-05 §3). `useActionState(createDraft)` wires
// the form to the Server Action, tracks the pending state, and surfaces the
// returned error. On success the action redirects to the `[id]` editor, so there is
// no success branch to render here. Gold is NOT used (no CTA in the admin) — the
// primary button is navy-on-white per DESIGN.md. The hero input is a path/URL over
// the seeded `public/seed/*.png` (no upload pipeline yet — slice-05 §8); hero alt
// is REQUIRED so the hero <img> never ships a null alt (MINOR-6).
export function ArticleDraftForm({ className = "" }: { className?: string }) {
  const [state, formAction, pending] = useActionState<
    CreateDraftState,
    FormData
  >(createDraft, undefined);

  return (
    <form
      action={formAction}
      data-testid="draft-form"
      className={`flex flex-col gap-4 ${className}`}
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Title
        <input
          type="text"
          name="title"
          required
          data-testid="draft-title"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Body
        <textarea
          name="body"
          required
          rows={8}
          data-testid="draft-body"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Category
        <input
          type="text"
          name="category"
          required
          data-testid="draft-category"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Hero image path
        <input
          type="text"
          name="coverImageUrl"
          required
          placeholder="/seed/season-opener.png"
          data-testid="draft-hero"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Hero alt text
        <input
          type="text"
          name="coverImageAlt"
          required
          data-testid="draft-hero-alt"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      {state?.error ? (
        <p data-testid="draft-error" className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid="draft-save"
        className="w-fit rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save draft"}
      </button>
    </form>
  );
}
