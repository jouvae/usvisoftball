import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAllStats, formatAsOf } from "@/lib/stats";
import { StatForm } from "@/components/client/stat-form";
// The delete island is action-shape generic ({ error } | undefined) — reused as-is.
import { EventDeleteButton } from "@/components/client/event-delete-button";
import { createStatAction, updateStatAction, deleteStatAction } from "./actions";

// The home stats admin screen (home-layout slice 4). Editor-only: `requireRole('editor')`
// runs as the FIRST await (redirects a non-editor to /admin) before any child renders — RLS
// re-enforces every write. Reads ALL stats (drafts included) through the editor session
// client (the 0023 editor-read policy). Per-request rendering is inherited from the
// protected layout.
export const dynamic = "force-dynamic";

export default async function StatsAdminPage() {
  await requireRole("editor");
  const stats = await listAllStats(await createSupabaseServerClient());

  return (
    <section data-testid="stats-admin" className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold text-navy">
          Home stats
        </h1>
        <p className="max-w-prose text-muted">
          The strip under the home page hero shows the first three <em>published</em> stats.
          Only publish a figure once it has been verified, and keep its “as of” date current.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-navy">Add a stat</h2>
        <StatForm
          action={createStatAction}
          formTestId="stat-add-form"
          submitTestId="stat-add"
          submitLabel="Add stat"
          errorTestId="stat-add-error"
        />
      </div>

      <ul className="flex flex-col gap-8">
        {stats.map((stat) => (
          <li
            key={stat.id}
            data-testid="stat-admin-item"
            data-stat-label={stat.label}
            className="flex flex-col gap-4 rounded-md border border-border p-4"
          >
            <h2
              data-testid="stat-admin-name"
              className="flex flex-wrap items-baseline gap-x-3 font-display text-xl font-semibold text-navy"
            >
              {stat.label} — {stat.value}
              <span className="font-sans text-sm font-normal text-muted">
                {stat.isPublished ? "Published" : "Draft"} · as of {formatAsOf(stat.asOf)}
              </span>
            </h2>
            <StatForm
              action={updateStatAction.bind(null, stat.id)}
              stat={stat}
              formTestId="stat-edit-form"
              submitTestId="stat-save"
              submitLabel="Save stat"
              errorTestId="stat-edit-error"
            />
            <EventDeleteButton
              action={deleteStatAction.bind(null, stat.id)}
              testId="stat-delete"
              errorTestId="stat-delete-error"
              label="Delete stat"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
