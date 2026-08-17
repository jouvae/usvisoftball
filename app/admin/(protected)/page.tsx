import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { readOwnProfile } from "@/lib/roles";
import { AI_DRAFT_ENABLED } from "@/lib/flags";

// The minimal dashboard placeholder — the "admin data" marker. It only renders for
// an authenticated request (the layout guard redirected anyone else), so these
// markers are never present in an anon response. `admin-authenticated` shows the
// signed-in user's email, read from the guard's `getUser()`.
//
// Slice 05a adds a NON-navigating `admin-roles` indicator: the caller's
// `profiles.roles`, read through the RLS-enforced session client (profiles_self_read:
// id = auth.uid()). It proves the profiles → trigger → has_role → RLS chain works in
// the browser. It ships NO links to the unbuilt /admin/articles/new or /admin/queue
// routes (those land in 05b) — a dead link would be a defect.
export default async function AdminDashboardPage() {
  const user = await requireUser();
  const profile = await readOwnProfile(user.id);
  const roles = profile?.roles ?? [];

  // Role-aware nav (slice-06 §4.1). A CONTRIBUTOR authors drafts (New article + own
  // queue); an EDITOR reviews (the editorial review queue). The New-article link
  // stays contributor-only — createDraft requires `contributor`, so a New-article
  // link for an editor would be a semi-dead link (the MAJOR-2 defect). But an editor
  // legitimately gets the /admin/queue link now (the editor-wide review queue). The
  // nav wrapper shows for either role. Authorization is re-enforced inside each
  // Server Action + by RLS; this gate only decides what to render. The 05a
  // `admin-roles` / `admin-authenticated` / `admin-dashboard` markers are preserved.
  const canAuthor = roles.includes("contributor");
  const canReview = roles.includes("editor");
  const showNav = canAuthor || canReview;

  return (
    <section data-testid="admin-dashboard">
      <h1 className="font-display text-3xl font-semibold text-brand">
        Admin dashboard
      </h1>
      <p data-testid="admin-authenticated" className="mt-2 text-muted">
        Signed in as {user.email}
      </p>
      <p data-testid="admin-roles" className="mt-1 text-sm text-muted">
        {roles.length > 0
          ? `Roles: ${roles.join(", ")}`
          : "No roles assigned"}
      </p>

      {showNav ? (
        <nav data-testid="admin-nav" className="mt-6 flex flex-wrap gap-3">
          {canAuthor ? (
            <Link
              data-testid="admin-new-article-link"
              href="/admin/articles/new"
              className="rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2"
            >
              New article
            </Link>
          ) : null}
          {canAuthor || canReview ? (
            <Link
              data-testid="admin-queue-link"
              href="/admin/queue"
              className="rounded-md border border-border px-4 py-2 font-medium text-brand outline-focus hover:bg-surface focus:outline-2"
            >
              Editorial queue
            </Link>
          ) : null}
          {/* The board admin screen (about-e2e-004..006) is editor-only — it mirrors
              the `canReview` gate. Every board Server Action re-runs requireRole
              ('editor') and RLS re-enforces at the row, so this gate only decides
              what to render. */}
          {canReview ? (
            <Link
              data-testid="admin-board-link"
              href="/admin/board"
              className="rounded-md border border-border px-4 py-2 font-medium text-brand outline-focus hover:bg-surface focus:outline-2"
            >
              Board admin
            </Link>
          ) : null}
          {/* The contact editor (about-e2e-010) is editor-only — same canReview gate;
              updateContactAction re-runs requireRole('editor') and RLS re-enforces. */}
          {canReview ? (
            <Link
              data-testid="admin-contact-link"
              href="/admin/contact"
              className="rounded-md border border-border px-4 py-2 font-medium text-brand outline-focus hover:bg-surface focus:outline-2"
            >
              Contact info
            </Link>
          ) : null}
          {/* The committees admin screen (about-e2e-012/013) is editor-only — same
              canReview gate; every committees Server Action re-runs requireRole('editor')
              and RLS re-enforces at the row, so this gate only decides what to render. */}
          {canReview ? (
            <Link
              data-testid="admin-committees-link"
              href="/admin/committees"
              className="rounded-md border border-border px-4 py-2 font-medium text-brand outline-focus hover:bg-surface focus:outline-2"
            >
              Committees admin
            </Link>
          ) : null}
          {/* The teams admin screen (teams-e2e-003) is editor-only — same canReview
              gate; every team Server Action re-runs requireRole('editor') and RLS
              re-enforces at the row, so this gate only decides what to render. */}
          {canReview ? (
            <Link
              data-testid="admin-teams-link"
              href="/admin/teams"
              className="rounded-md border border-border px-4 py-2 font-medium text-brand outline-focus hover:bg-surface focus:outline-2"
            >
              Teams admin
            </Link>
          ) : null}
          {/* The events admin screen (events-e2e-003) is editor-only — same canReview
              gate; every event Server Action re-runs requireRole('editor') and RLS
              re-enforces at the row, so this gate only decides what to render. */}
          {canReview ? (
            <Link
              data-testid="admin-events-link"
              href="/admin/events"
              className="rounded-md border border-border px-4 py-2 font-medium text-brand outline-focus hover:bg-surface focus:outline-2"
            >
              Events admin
            </Link>
          ) : null}
          {/* The AI draft panel is for contributor OR editor (slice-09 §5.1), and
              only when the NEXT_PUBLIC_AI_DRAFT_ENABLED flag is on — prod hides it. */}
          {AI_DRAFT_ENABLED && (canAuthor || canReview) ? (
            <Link
              data-testid="admin-ai-draft-link"
              href="/admin/news/ai"
              className="rounded-md border border-border px-4 py-2 font-medium text-brand outline-focus hover:bg-surface focus:outline-2"
            >
              AI draft
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
