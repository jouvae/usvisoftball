export type EmptyStateProps = {
  className?: string;
};

// Zero-published UI (slice-02 §5). A NORMAL state, not an error — no thrown error,
// no error boundary, HTTP 200. Its heading is the page's sole <h1> in the empty
// state (slice-02 §6).
export function EmptyState({ className = "" }: EmptyStateProps) {
  return (
    <div
      data-testid="news-empty-state"
      className={`flex flex-col gap-3 py-16 ${className}`}
    >
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-brand">
        No stories yet
      </h1>
      <p className="text-muted">
        Check back soon for the latest USVI softball news.
      </p>
    </div>
  );
}
