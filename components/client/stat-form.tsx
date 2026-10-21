"use client";

import { useActionState } from "react";
// ANTI-LEAK: client-safe runtime values come from the view module (no `server-only`), NEVER
// from "@/lib/stats" (server-only).
import { STAT_ICON_LABELS, STAT_LIMITS } from "@/lib/stats-view";
import type { HomeStat, StatIcon } from "@/lib/stats-view";
import type { StatActionState } from "@/app/admin/(protected)/stats/actions";

const inputClass =
  "rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2";
const labelClass = "flex flex-col gap-1 text-sm font-medium text-foreground";
const hintClass = "text-xs font-normal text-muted";

// The home-stat form island (home-layout slice 4). ONE island serves BOTH add and edit: the
// caller passes an id-bound `action`, the mode-specific testids, and (for edit) a `stat` to
// prefill. `useActionState` tracks pending + surfaces the returned error. On success the
// action revalidates "/" and this route, so the list re-renders in the same response. Field
// limits mirror the 0023 CHECKs via STAT_LIMITS. Navy-on-white per DESIGN.md.
export function StatForm({
  action,
  stat,
  formTestId,
  submitTestId,
  submitLabel,
  errorTestId,
  className = "",
}: {
  action: (
    prevState: StatActionState,
    formData: FormData,
  ) => Promise<StatActionState>;
  stat?: HomeStat;
  formTestId: string;
  submitTestId: string;
  submitLabel: string;
  errorTestId: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<StatActionState, FormData>(
    action,
    undefined,
  );
  const iconKeys = Object.keys(STAT_ICON_LABELS) as StatIcon[];

  return (
    <form
      action={formAction}
      data-testid={formTestId}
      className={`grid gap-3 sm:grid-cols-2 ${className}`}
    >
      <label className={labelClass}>
        Label
        <span className={hintClass}>Who or what the figure is about — “Women’s National Team”</span>
        <input
          type="text"
          name="label"
          required
          maxLength={STAT_LIMITS.label}
          defaultValue={stat?.label ?? ""}
          data-testid="stat-label"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Value
        <span className={hintClass}>The big figure, {STAT_LIMITS.value} characters max — “No. 32”, “Silver”</span>
        <input
          type="text"
          name="value"
          required
          maxLength={STAT_LIMITS.value}
          defaultValue={stat?.value ?? ""}
          data-testid="stat-value"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Detail
        <span className={hintClass}>Optional one-liner — “WBSC world ranking”</span>
        <input
          type="text"
          name="detail"
          maxLength={STAT_LIMITS.detail}
          defaultValue={stat?.detail ?? ""}
          data-testid="stat-detail"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Icon
        <select
          name="icon"
          defaultValue={stat?.icon ?? "trophy"}
          data-testid="stat-icon"
          className={inputClass}
        >
          {iconKeys.map((key) => (
            <option key={key} value={key}>
              {STAT_ICON_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        As of
        <span className={hintClass}>When the figure was true — shown on the site</span>
        <input
          type="date"
          name="asOf"
          required
          defaultValue={stat?.asOf ?? ""}
          data-testid="stat-as-of"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Source link
        <span className={hintClass}>Optional https:// link that verifies the figure</span>
        <input
          type="url"
          name="sourceUrl"
          placeholder="https://"
          defaultValue={stat?.sourceUrl ?? ""}
          data-testid="stat-source"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Sort order
        <span className={hintClass}>Lower shows first; the home page shows the first three</span>
        <input
          type="number"
          name="sortOrder"
          step={1}
          defaultValue={stat?.sortOrder ?? 0}
          data-testid="stat-sort"
          className={inputClass}
        />
      </label>

      <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          name="isPublished"
          value="1"
          defaultChecked={stat?.isPublished ?? false}
          data-testid="stat-published"
        />
        Published on the home page
      </label>

      {state?.error ? (
        <p data-testid={errorTestId} className="text-sm text-muted sm:col-span-2">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid={submitTestId}
        className="w-fit rounded-md bg-brand px-4 py-2 font-medium text-brand-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60 sm:col-span-2"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
