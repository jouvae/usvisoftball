import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listManualHighlights } from "@/lib/feed";
import { formatShortDate, ATLANTIC_TZ } from "@/lib/schedule-view";
import { HighlightForm } from "@/components/client/highlight-form";
// The delete island is action-shape generic ({ error } | undefined) — reused as-is.
import { EventDeleteButton } from "@/components/client/event-delete-button";
import {
  createHighlightAction,
  deleteHighlightAction,
  updateHighlightAction,
} from "./actions";

// The highlights admin screen (home-feed H7). Editor-only: `requireRole('editor')` runs first.
// Lists every MANUAL highlight (drafts included). Game results are not listed: they are added
// to the rail automatically when a USVI game is marked Final, and follow the game's score.
export const dynamic = "force-dynamic";

export default async function HighlightsAdminPage() {
  await requireRole("editor");
  const highlights = await listManualHighlights(await createSupabaseServerClient());

  return (
    <section data-testid="highlights-admin" className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold text-navy">Home highlights</h1>
        <p className="max-w-prose text-muted">
          Short text items in the column beside the home page stories, newest first. USVI final
          scores appear there on their own when a game is marked Final — add anything else here:
          a milestone, a ranking, a press mention.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-navy">Add a highlight</h2>
        <HighlightForm
          action={createHighlightAction}
          formTestId="highlight-add-form"
          submitTestId="highlight-add"
          submitLabel="Add highlight"
          errorTestId="highlight-add-error"
        />
      </div>

      <ul className="flex flex-col gap-8">
        {highlights.map((h) => (
          <li
            key={h.id}
            data-testid="highlight-admin-item"
            className="flex flex-col gap-4 rounded-md border border-border p-4"
          >
            <p className="text-sm text-muted">
              {h.isPublished ? "On the home page" : "Hidden"} · added{" "}
              {formatShortDate(h.publishedAt, ATLANTIC_TZ, "en")}
            </p>
            <HighlightForm
              action={updateHighlightAction.bind(null, h.id)}
              highlight={h}
              formTestId="highlight-edit-form"
              submitTestId="highlight-save"
              submitLabel="Save highlight"
              errorTestId="highlight-edit-error"
            />
            <EventDeleteButton
              action={deleteHighlightAction.bind(null, h.id)}
              testId="highlight-delete"
              errorTestId="highlight-delete-error"
              label="Delete highlight"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
