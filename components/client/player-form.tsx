"use client";

import { useActionState } from "react";
import { safePhotoHref } from "@/lib/teams-view";
import type { TeamPlayer } from "@/lib/teams-view";
import type { PlayerActionState } from "@/app/admin/(protected)/teams/[slug]/actions";

// The roster player form island (teams-e2e-004). Mirrors the committee-member form: ONE
// island serves BOTH add and edit via an id-bound `action` + mode-specific testids. Photo
// precedence is resolved server-side: a chosen file → upload; else the remove toggle →
// clear; else the local path text; else the player's CURRENT photo is preserved
// authoritatively. Only a LOCAL /public path prefills the text box; an uploaded Storage URL
// is shown as a preview. Navy-on-white per DESIGN.md.
export function PlayerForm({
  action,
  player,
  formTestId,
  submitTestId,
  submitLabel,
  errorTestId,
  className = "",
}: {
  action: (
    prevState: PlayerActionState,
    formData: FormData,
  ) => Promise<PlayerActionState>;
  player?: TeamPlayer;
  formTestId: string;
  submitTestId: string;
  submitLabel: string;
  errorTestId: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<
    PlayerActionState,
    FormData
  >(action, undefined);

  const currentPhoto = player?.photoUrl ?? "";
  const previewSrc = safePhotoHref(currentPhoto); // guard the preview too (consistency)
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
          defaultValue={player?.name ?? ""}
          data-testid="pl-name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Jersey number
        <input
          type="number"
          name="jerseyNumber"
          defaultValue={player?.jerseyNumber ?? ""}
          data-testid="pl-number"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Position
        <input
          type="text"
          name="position"
          defaultValue={player?.position ?? ""}
          data-testid="pl-position"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Bats / Throws
        <input
          type="text"
          name="batsThrows"
          defaultValue={player?.batsThrows ?? ""}
          data-testid="pl-bt"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Hometown
        <input
          type="text"
          name="hometown"
          defaultValue={player?.hometown ?? ""}
          data-testid="pl-hometown"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      {/* Photo. Precedence (server-side): a chosen file → upload; else remove-toggle →
          clear; else the local path text; else the player's CURRENT photo is preserved
          server-side (read authoritatively, not from any client field). */}
      {currentPhoto ? (
        <div className="flex items-center gap-3">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt=""
              data-testid="pl-photo-current"
              className="h-16 w-16 rounded-md border border-border object-cover"
            />
          ) : null}
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="removePhoto"
              value="1"
              data-testid="pl-photo-remove"
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
          data-testid="pl-photo-file"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        …or a local image path
        <input
          type="text"
          name="photoUrl"
          placeholder="/seed/player.png"
          defaultValue={localPathValue}
          data-testid="pl-photo"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Sort order
        <input
          type="number"
          name="sortOrder"
          defaultValue={player?.sortOrder ?? 0}
          data-testid="pl-sort"
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
