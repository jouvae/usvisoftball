"use client";

import { useActionState } from "react";
// ANTI-LEAK: EVENT_ISLAND_LABELS is a client-safe RUNTIME value — import it from the
// view module (no `server-only`), NEVER from "@/lib/events" (server-only). FederationEvent
// is a type-only import from the same client-safe module.
import { EVENT_ISLAND_LABELS, safeEventLogoHref } from "@/lib/events-view";
import type { FederationEvent, EventIsland } from "@/lib/events-view";
import type { EventActionState } from "@/app/admin/(protected)/events/actions";

// The event form island (events-e2e-003). ONE island serves BOTH add and edit: the caller
// passes an id-bound `action`, the mode-specific testids, and (for edit) an `event` to
// prefill. `useActionState` tracks pending + surfaces the returned error. On success the
// action revalidates this route, so the list re-renders in the same response. Logo handling
// mirrors the team-form block: a chosen file → upload; else the remove toggle → clear; else
// the local-path text; else the current logo is preserved server-side. Only a LOCAL /public
// path prefills the text box; an uploaded Storage URL is shown as a preview. The island
// <select> leads with a Territory-wide ('' → null) option. Navy-on-white per DESIGN.md.
export function EventForm({
  action,
  event,
  formTestId,
  submitTestId,
  submitLabel,
  errorTestId,
  className = "",
}: {
  action: (
    prevState: EventActionState,
    formData: FormData,
  ) => Promise<EventActionState>;
  event?: FederationEvent;
  formTestId: string;
  submitTestId: string;
  submitLabel: string;
  errorTestId: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<
    EventActionState,
    FormData
  >(action, undefined);

  const islandKeys = Object.keys(EVENT_ISLAND_LABELS) as EventIsland[];
  const currentLogo = event?.logoUrl ?? "";
  const previewSrc = safeEventLogoHref(currentLogo); // guard the preview too
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
          defaultValue={event?.name ?? ""}
          data-testid="event-name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Island
        <select
          name="island"
          defaultValue={event?.island ?? ""}
          data-testid="event-island"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        >
          <option value="">Territory-wide (all islands)</option>
          {islandKeys.map((key) => (
            <option key={key} value={key}>
              {EVENT_ISLAND_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Start date
        <input
          type="date"
          name="startDate"
          defaultValue={event?.startDate ?? ""}
          data-testid="event-start"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        End date
        <input
          type="date"
          name="endDate"
          defaultValue={event?.endDate ?? ""}
          data-testid="event-end"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Venue
        <input
          type="text"
          name="venue"
          defaultValue={event?.venue ?? ""}
          data-testid="event-venue"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Description
        <textarea
          name="description"
          rows={3}
          defaultValue={event?.description ?? ""}
          data-testid="event-description"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Sort order
        <input
          type="number"
          name="sortOrder"
          defaultValue={event?.sortOrder ?? 0}
          data-testid="event-sort"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      {/* Logo. Precedence (server-side): a chosen file → upload; else remove-toggle →
          clear; else the local path text; else the event's CURRENT logo is preserved
          server-side (read authoritatively, not from any client field). */}
      {currentLogo ? (
        <div className="flex items-center gap-3">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt=""
              data-testid="event-logo-current"
              className="h-16 w-16 rounded-md border border-border object-contain"
            />
          ) : null}
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="removeLogo"
              value="1"
              data-testid="event-logo-remove"
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
          data-testid="event-logo-file"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        …or a local image path
        <input
          type="text"
          name="logoUrl"
          placeholder="/seed/event.png"
          defaultValue={localPathValue}
          data-testid="event-logo"
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
