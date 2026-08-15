"use client";

import { useActionState } from "react";
import type { CommitteeMember } from "@/lib/committees";
import type { CommitteeMemberActionState } from "@/app/admin/(protected)/committees/actions";

// The committee-member form island (about-e2e-013). Mirrors the board-member form: ONE
// island serves BOTH add and edit via an id-bound `action` + mode-specific testids.
// Committee members carry a free-text ROLE + BIO (no board seat). Photo precedence is
// resolved server-side: a chosen file → upload; else the remove toggle → clear; else the
// local path text; else the member's CURRENT photo is preserved authoritatively. Only a
// LOCAL /public path prefills the text box; an uploaded Storage URL is shown as a preview.
// Navy-on-white per DESIGN.md; no gold, no dangerouslySetInnerHTML.
export function CommitteeMemberForm({
  action,
  member,
  formTestId,
  submitTestId,
  submitLabel,
  errorTestId,
  className = "",
}: {
  action: (
    prevState: CommitteeMemberActionState,
    formData: FormData,
  ) => Promise<CommitteeMemberActionState>;
  member?: CommitteeMember;
  formTestId: string;
  submitTestId: string;
  submitLabel: string;
  errorTestId: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<
    CommitteeMemberActionState,
    FormData
  >(action, undefined);

  const currentPhoto = member?.photoUrl ?? "";
  const localPathValue = currentPhoto.startsWith("/") ? currentPhoto : "";

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
          defaultValue={member?.name ?? ""}
          data-testid="cm-name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Role
        <input
          type="text"
          name="role"
          defaultValue={member?.role ?? ""}
          data-testid="cm-role"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Bio
        <textarea
          name="bio"
          rows={3}
          defaultValue={member?.bio ?? ""}
          data-testid="cm-bio"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      {/* Photo. Precedence (server-side): a chosen file → upload; else remove-toggle →
          clear; else the local path text; else the member's CURRENT photo is preserved
          server-side (read authoritatively, not from any client field). */}
      {currentPhoto ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentPhoto}
            alt=""
            data-testid="cm-photo-current"
            className="h-16 w-16 rounded-md border border-border object-cover"
          />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="removePhoto"
              value="1"
              data-testid="cm-photo-remove"
            />
            Remove photo
          </label>
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Photo — upload an image (JPEG, PNG, or WebP, max 2 MB)
        <input
          type="file"
          name="photoFile"
          accept="image/jpeg,image/png,image/webp"
          data-testid="cm-photo-file"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        …or a local image path
        <input
          type="text"
          name="photoUrl"
          placeholder="/seed/member.png"
          defaultValue={localPathValue}
          data-testid="cm-photo"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Sort order
        <input
          type="number"
          name="sortOrder"
          defaultValue={member?.sortOrder ?? 0}
          data-testid="cm-sort"
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
