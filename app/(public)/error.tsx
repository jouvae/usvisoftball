"use client";

import Link from "next/link";

// Branded error boundary for the public route group (R1). error.tsx MUST be a Client
// Component (it receives the `reset` callback and is a React error boundary). It renders
// on a real DB/transport throw from a public read (the reads throw rather than mask an
// outage), inside the public layout's <main> — so it emits NO <main> of its own. It
// deliberately does NOT render `error.message` (it may carry internals); the copy is
// generic. `reset()` retries the failed segment; the link offers a safe way back.
export default function PublicError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      data-testid="public-error"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-4 py-24"
    >
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-brand">
        Something went wrong
      </h1>
      <p className="text-muted">
        We hit a problem loading this page. Please try again in a moment.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => reset()}
          data-testid="public-error-retry"
          className="rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2"
        >
          Try again
        </button>
        <Link
          href="/"
          data-testid="public-error-home"
          className="font-display font-semibold text-brand hover:text-brand-hover"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
