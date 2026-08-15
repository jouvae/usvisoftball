import { requireRole } from "@/lib/roles";
import { getMission, listCurrentBoard, SEAT_LABELS } from "@/lib/board";
import { MissionEditForm } from "@/components/client/mission-edit-form";
import { BoardMemberForm } from "@/components/client/board-member-form";
import { BoardMemberDeleteButton } from "@/components/client/board-member-delete-button";
import { RollTermForm } from "@/components/client/roll-term-form";
import {
  createBoardMemberAction,
  updateBoardMemberAction,
  deleteBoardMemberAction,
} from "./actions";

// The board admin screen (about-e2e-004..006). Editor-only: `requireRole('editor')`
// runs as the FIRST await (redirects a non-editor to /admin), before any child renders
// — RLS re-enforces every write, but the action must not proceed without the role. The
// tables are mutable and read via the RLS client, so force per-request rendering: the
// roster + mission must reflect the live rows after each write revalidation.
export const dynamic = "force-dynamic";

export default async function BoardAdminPage() {
  await requireRole("editor");

  const [mission, roster] = await Promise.all([
    getMission(),
    listCurrentBoard(),
  ]);

  return (
    <section data-testid="board-admin" className="flex flex-col gap-10">
      <h1 className="font-display text-3xl font-semibold text-brand">
        Board administration
      </h1>

      {/* ── edit-mission ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-brand">
          Mission statement
        </h2>
        <MissionEditForm defaultBody={mission?.body ?? ""} />
      </div>

      {/* ── current-term roster editor ───────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold text-brand">
          {roster
            ? `Current roster — ${roster.term.label}`
            : "Current roster"}
        </h2>

        {roster ? (
          <>
            {roster.members.length > 0 ? (
              <ul data-testid="board-roster" className="flex flex-col gap-6">
                {roster.members.map((member) => (
                  <li
                    key={member.id}
                    data-testid="board-roster-item"
                    className="flex flex-col gap-3 rounded-md border border-border p-4"
                  >
                    <div className="text-sm text-muted">
                      {member.name} · {SEAT_LABELS[member.seat]} · {member.role}
                    </div>
                    <BoardMemberForm
                      action={updateBoardMemberAction.bind(null, member.id)}
                      member={member}
                      formTestId="member-edit-form"
                      submitTestId="member-save"
                      submitLabel="Save member"
                      errorTestId="member-edit-error"
                    />
                    <BoardMemberDeleteButton
                      action={deleteBoardMemberAction.bind(null, member.id)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p data-testid="board-roster" className="text-muted">
                No members on the current term yet. Add the first one below.
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-6">
              <h3 className="font-display text-lg font-semibold text-brand">
                Add a member
              </h3>
              <BoardMemberForm
                action={createBoardMemberAction.bind(null, roster.term.id)}
                formTestId="member-add-form"
                submitTestId="member-add"
                submitLabel="Add member"
                errorTestId="member-add-error"
              />
            </div>
          </>
        ) : (
          <p className="text-muted">
            No current term is set. Roll a new term below to start a roster.
          </p>
        )}
      </div>

      {/* ── term-rollover ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-brand">
          Roll to a new term
        </h2>
        <RollTermForm />
      </div>
    </section>
  );
}
