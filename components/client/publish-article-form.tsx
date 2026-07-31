"use client";

import { useActionState } from "react";
import type { PublishArticleState } from "@/app/admin/(protected)/review/[id]/actions";

// The publish island (slice-06 §4.3). A thin `<form action>` wrapper around the
// id-bound `publishArticle` Server Action (passed in as `action` — the review page
// binds the id server-side so it is a closure reference, not a forgeable field).
// The body `<textarea>` is prefilled with the article's current body (defaultValue),
// so the editor edits in place; the field is submitted as `body`. `useActionState`
// tracks pending + surfaces the returned error. On success the action revalidates
// this route, so the status badge re-renders to Published in the same response — no
// client state to manage. Gold is NOT used (no CTA in the admin) — the Publish
// button is navy-on-white per DESIGN.md. `dangerouslySetInnerHTML` stays banned.
export function PublishArticleForm({
  action,
  defaultBody,
  className = "",
  submitLabel = "Publish",
  submitTestId = "publish-article",
}: {
  action: (
    prevState: PublishArticleState,
    formData: FormData,
  ) => Promise<PublishArticleState>;
  defaultBody: string;
  className?: string;
  // slice-08 §4: lets the SAME island serve in_review (Publish) and unpublished
  // (Re-publish) with a distinct submit testid, reusing the identical publishArticle
  // action + publish-article-error slot. Omitted => byte-for-byte the in_review form.
  submitLabel?: string;
  submitTestId?: string;
}) {
  const [state, formAction, pending] = useActionState<
    PublishArticleState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className={`flex flex-col gap-4 ${className}`}>
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Body
        <textarea
          name="body"
          rows={10}
          defaultValue={defaultBody}
          data-testid="editor-body"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      {state?.error ? (
        <p data-testid="publish-article-error" className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid={submitTestId}
        className="w-fit rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60"
      >
        {pending ? `${submitLabel}ing…` : submitLabel}
      </button>
    </form>
  );
}
