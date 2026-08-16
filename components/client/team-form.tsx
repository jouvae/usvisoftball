"use client";

import { useActionState } from "react";
// ANTI-LEAK: ISLAND_LABELS is a client-safe RUNTIME value — import it from the
// view module (no `server-only`), NEVER from "@/lib/teams" (server-only). Team is
// a type-only import from the same client-safe module.
import { ISLAND_LABELS } from "@/lib/teams-view";
import type { Team, Island } from "@/lib/teams-view";
import type { TeamActionState } from "@/app/admin/(protected)/teams/actions";

// The team form island (teams-e2e-003). ONE island serves BOTH add and edit: the caller
// passes an id-bound `action`, the mode-specific testids, and (for edit) a `team` to
// prefill. `useActionState` tracks pending + surfaces the returned error. On success the
// action revalidates this route, so the list re-renders in the same response. Logo handling
// mirrors the committee-member photo block: a chosen file → upload; else the remove toggle
// → clear; else the local-path text; else the current logo is preserved server-side. Only a
// LOCAL /public path prefills the text box; an uploaded Storage URL is shown as a preview.
// Navy-on-white per DESIGN.md; no gold, no dangerouslySetInnerHTML.
export function TeamForm({
  action,
  team,
  formTestId,
  submitTestId,
  submitLabel,
  errorTestId,
  className = "",
}: {
  action: (
    prevState: TeamActionState,
    formData: FormData,
  ) => Promise<TeamActionState>;
  team?: Team;
  formTestId: string;
  submitTestId: string;
  submitLabel: string;
  errorTestId: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<TeamActionState, FormData>(
    action,
    undefined,
  );

  const islandKeys = Object.keys(ISLAND_LABELS) as Island[];
  const currentLogo = team?.logoUrl ?? "";
  const localPathValue = currentLogo.startsWith("/") ? currentLogo : "";

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
          defaultValue={team?.name ?? ""}
          data-testid="team-name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Island
        <select
          name="island"
          defaultValue={team?.island ?? islandKeys[0]}
          data-testid="team-island"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        >
          {islandKeys.map((key) => (
            <option key={key} value={key}>
              {ISLAND_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Division
        <input
          type="text"
          name="division"
          defaultValue={team?.division ?? ""}
          data-testid="team-division"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Description
        <textarea
          name="description"
          rows={3}
          defaultValue={team?.description ?? ""}
          data-testid="team-description"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Home venue
        <input
          type="text"
          name="homeVenue"
          defaultValue={team?.homeVenue ?? ""}
          data-testid="team-venue"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Founded year
        <input
          type="number"
          name="foundedYear"
          defaultValue={team?.foundedYear ?? ""}
          data-testid="team-founded"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Sort order
        <input
          type="number"
          name="sortOrder"
          defaultValue={team?.sortOrder ?? 0}
          data-testid="team-sort"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      {/* Logo. Precedence (server-side): a chosen file → upload; else remove-toggle →
          clear; else the local path text; else the team's CURRENT logo is preserved
          server-side (read authoritatively, not from any client field). */}
      {currentLogo ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentLogo}
            alt=""
            data-testid="team-logo-current"
            className="h-16 w-16 rounded-md border border-border object-contain"
          />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="removeLogo"
              value="1"
              data-testid="team-logo-remove"
            />
            Remove logo
          </label>
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Logo — upload an image (JPEG, PNG, or WebP)
        <input
          type="file"
          name="logoFile"
          accept="image/jpeg,image/png,image/webp"
          data-testid="team-logo-file"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        …or a local image path
        <input
          type="text"
          name="logoUrl"
          placeholder="/seed/team.png"
          defaultValue={localPathValue}
          data-testid="team-logo"
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
