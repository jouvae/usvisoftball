"use client";

import Link from "next/link";

// Branded error boundary for the protected admin subtree (R1). error.tsx MUST be a
// Client Component (it owns the React error boundary + the `reset` callback). It renders
// on a real DB/transport throw from an admin read, inside the protected layout's
// <main data-testid="admin-main"> — so it emits NO <main> of its own. It never renders
// `error.message` (may carry internals). NOTE: this boundary is BELOW the layout's
// requireUser() guard, so an unauthenticated request is still redirected before this can
// render — the gate is never downgraded. `reset()` retries; the link returns to the
// dashboard.
export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      data-testid="admin-error"
      className="flex flex-col items-start gap-4"
    >
      <h1 className="font-display text-3xl font-semibold text-brand">
        Something went wrong
      </h1>
      <p className="text-muted">
        We hit a problem loading this view. Please try again.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => reset()}
          data-testid="admin-error-retry"
          className="rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2"
        >
          Try again
        </button>
        <Link
          href="/admin"
          data-testid="admin-error-home"
          className="font-medium text-brand hover:text-brand-hover"
        >
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
