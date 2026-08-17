import { requireRole } from "@/lib/roles";
import { listEvents } from "@/lib/events";
import { EventForm } from "@/components/client/event-form";
import { EventDeleteButton } from "@/components/client/event-delete-button";
import {
  createEventAction,
  updateEventAction,
  deleteEventAction,
} from "./actions";

// The events admin screen (events-e2e-003). Editor-only: `requireRole('editor')` runs as the
// FIRST await (redirects a non-editor to /admin) before any child renders — RLS re-enforces
// every write, but the page must not proceed without the role. Events are mutable and read
// via the RLS client, so force per-request rendering: the list must reflect the live rows
// after each write revalidation. Flat list ordered by sortOrder then name is fine for admin.
export const dynamic = "force-dynamic";

export default async function EventsAdminPage() {
  await requireRole("editor");

  const events = [...(await listEvents())].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );

  return (
    <section data-testid="events-admin" className="flex flex-col gap-10">
      <h1 className="font-display text-3xl font-semibold text-brand">
        Events administration
      </h1>

      {/* ── add-event ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-brand">
          Add an event
        </h2>
        <EventForm
          action={createEventAction}
          formTestId="event-add-form"
          submitTestId="event-add"
          submitLabel="Add event"
          errorTestId="event-add-error"
        />
      </div>

      {/* ── event list ───────────────────────────────────────────────────── */}
      <ul className="flex flex-col gap-8">
        {events.map((event) => (
          <li
            key={event.id}
            data-testid="event-admin-item"
            className="flex flex-col gap-4 rounded-md border border-border p-4"
          >
            <h2
              data-testid="event-admin-name"
              className="font-display text-xl font-semibold text-brand"
            >
              {event.name}
            </h2>
            <EventForm
              action={updateEventAction.bind(null, event.id)}
              event={event}
              formTestId="event-edit-form"
              submitTestId="event-save"
              submitLabel="Save event"
              errorTestId="event-edit-error"
            />
            <div className="flex flex-wrap items-center gap-3">
              <EventDeleteButton
                action={deleteEventAction.bind(null, event.id)}
                testId="event-delete"
                errorTestId="event-delete-error"
                label="Delete event"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
