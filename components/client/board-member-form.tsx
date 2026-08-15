"use client";

import { useActionState } from "react";
import { SEAT_LABELS, type BoardMember } from "@/lib/board-view";
import type { BoardMemberActionState } from "@/app/admin/(protected)/board/actions";

// The board-member form island (about-e2e-005). ONE island serves BOTH add and edit:
// the caller passes an id/term-bound `action`, the mode-specific testids, and (for
// edit) a `member` to prefill. `useActionState` tracks pending + surfaces the returned
// error. On success the action revalidates this route, so the roster re-renders in the
// same response — no client state to manage. Gold is NOT used in the admin — the submit
// is navy-on-white per DESIGN.md. `dangerouslySetInnerHTML` stays banned.
export function BoardMemberForm({
  action,
  member,
  formTestId,
  submitTestId,
  submitLabel,
  errorTestId,
  className = "",
}: {
  action: (
    prevState: BoardMemberActionState,
    formData: FormData,
  ) => Promise<BoardMemberActionState>;
  member?: BoardMember;
  formTestId: string;
  submitTestId: string;
  submitLabel: string;
  errorTestId: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<
    BoardMemberActionState,
    FormData
  >(action, undefined);

  const seatKeys = Object.keys(SEAT_LABELS) as (keyof typeof SEAT_LABELS)[];

  // Only a LOCAL /public path prefills the text box; an uploaded Storage URL (http…) is
  // preserved via the hidden currentPhotoUrl + shown as a preview, not dumped as raw text.
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
          data-testid="member-name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Seat
        <select
          name="seat"
          defaultValue={member?.seat ?? seatKeys[0]}
          data-testid="member-seat"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        >
          {seatKeys.map((key) => (
            <option key={key} value={key}>
              {SEAT_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Role
        <input
          type="text"
          name="role"
          required
          defaultValue={member?.role ?? ""}
          data-testid="member-role"
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
            data-testid="member-photo-current"
            className="h-16 w-16 rounded-md border border-border object-cover"
          />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="removePhoto"
              value="1"
              data-testid="member-photo-remove"
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
          data-testid="member-photo-file"
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
          data-testid="member-photo"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Bio
        <textarea
          name="bio"
          rows={3}
          defaultValue={member?.bio ?? ""}
          data-testid="member-bio"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Sort order
        <input
          type="number"
          name="sortOrder"
          defaultValue={member?.sortOrder ?? 0}
          data-testid="member-sort"
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
