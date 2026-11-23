"use client";

import { useActionState } from "react";
import type { SetGameState } from "@/app/admin/(protected)/review/[id]/actions";

export interface GameOption {
  id: string; // game id
  label: string; // "Nov 21 · Colombia vs U.S. Virgin Islands"
  group: string; // tournament name
}

// The review desk's "Linked game" picker (home-feed H9): a recap linked to its game shows the
// score above its headline on the home feed. USVI games only, grouped by tournament. A thin
// <form action> over the id-bound setLinkedGame Server Action; "No game" unlinks.
export function ArticleGameForm({
  action,
  gameId,
  options,
}: {
  action: (prev: SetGameState, formData: FormData) => Promise<SetGameState>;
  gameId: string | null;
  options: GameOption[];
}) {
  const [state, formAction, pending] = useActionState<SetGameState, FormData>(action, undefined);
  const groups = [...new Set(options.map((o) => o.group))];

  return (
    <form action={formAction} data-testid="article-game-form" className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Linked game
        <span className="text-xs font-normal text-muted">
          For a game recap: the home page shows this game&apos;s score above the headline.
        </span>
        <select
          name="gameId"
          defaultValue={gameId ?? ""}
          data-testid="article-game-select"
          className="max-w-md rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        >
          <option value="">No game</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {options
                .filter((o) => o.group === g)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      {state?.error ? (
        <p data-testid="article-game-error" className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}
      {state?.saved ? (
        <p data-testid="article-game-saved" className="text-sm text-muted">
          Saved.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        data-testid="article-game-save"
        className="w-fit rounded-md border border-brand bg-background px-4 py-2 font-medium text-brand outline-focus hover:bg-surface focus:outline-2 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save linked game"}
      </button>
    </form>
  );
}
