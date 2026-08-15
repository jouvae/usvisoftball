import { requireRole } from "@/lib/roles";
import { listCommittees } from "@/lib/committees";
import { CommitteeForm } from "@/components/client/committee-form";
import { CommitteeMemberForm } from "@/components/client/committee-member-form";
import { CommitteeDeleteButton } from "@/components/client/committee-delete-button";
import {
  createCommitteeAction,
  updateCommitteeAction,
  deleteCommitteeAction,
  createCommitteeMemberAction,
  updateCommitteeMemberAction,
  deleteCommitteeMemberAction,
} from "./actions";

// The committees admin screen (about-e2e-012/013). Editor-only: `requireRole('editor')`
// runs as the FIRST await (redirects a non-editor to /admin) before any child renders —
// RLS re-enforces every write, but the page must not proceed without the role. Committees
// are mutable and read via the RLS client, so force per-request rendering: the list must
// reflect the live rows after each write revalidation.
export const dynamic = "force-dynamic";

export default async function CommitteesAdminPage() {
  await requireRole("editor");

  const committees = await listCommittees();

  return (
    <section data-testid="committees-admin" className="flex flex-col gap-10">
      <h1 className="font-display text-3xl font-semibold text-brand">
        Committees administration
      </h1>

      {/* ── add-committee ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-brand">
          Add a committee
        </h2>
        <CommitteeForm
          action={createCommitteeAction}
          formTestId="committee-add-form"
          submitTestId="committee-add"
          submitLabel="Add committee"
          errorTestId="committee-add-error"
        />
      </div>

      {/* ── committee list ───────────────────────────────────────────────── */}
      <ul className="flex flex-col gap-8">
        {committees.map((committee) => (
          <li
            key={committee.id}
            data-testid="committee-admin-item"
            className="flex flex-col gap-4 rounded-md border border-border p-4"
          >
            <h2
              data-testid="committee-admin-name"
              className="font-display text-xl font-semibold text-brand"
            >
              {committee.name}
            </h2>
            <CommitteeForm
              action={updateCommitteeAction.bind(null, committee.id)}
              committee={committee}
              formTestId="committee-edit-form"
              submitTestId="committee-save"
              submitLabel="Save committee"
              errorTestId="committee-edit-error"
            />
            <CommitteeDeleteButton
              action={deleteCommitteeAction.bind(null, committee.id)}
              testId="committee-delete"
              errorTestId="committee-delete-error"
              label="Delete committee"
            />

            {/* ── members ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-6 border-t border-border pt-6">
              <h3 className="font-display text-lg font-semibold text-brand">
                Members
              </h3>

              {committee.members.map((member) => (
                <div
                  key={member.id}
                  data-testid="committee-member-admin-item"
                  className="flex flex-col gap-3 rounded-md border border-border p-4"
                >
                  <div
                    data-testid="cm-admin-name"
                    className="text-sm text-muted"
                  >
                    {member.name}
                    {member.role ? ` · ${member.role}` : ""}
                  </div>
                  <CommitteeMemberForm
                    action={updateCommitteeMemberAction.bind(null, member.id)}
                    member={member}
                    formTestId="cm-edit-form"
                    submitTestId="cm-save"
                    submitLabel="Save member"
                    errorTestId="cm-edit-error"
                  />
                  <CommitteeDeleteButton
                    action={deleteCommitteeMemberAction.bind(null, member.id)}
                    testId="cm-delete"
                    errorTestId="cm-delete-error"
                    label="Remove"
                  />
                </div>
              ))}

              <div className="flex flex-col gap-3 border-t border-border pt-6">
                <h4 className="font-display text-base font-semibold text-brand">
                  Add a member
                </h4>
                <CommitteeMemberForm
                  action={createCommitteeMemberAction.bind(null, committee.id)}
                  formTestId="cm-add-form"
                  submitTestId="cm-add"
                  submitLabel="Add member"
                  errorTestId="cm-add-error"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
