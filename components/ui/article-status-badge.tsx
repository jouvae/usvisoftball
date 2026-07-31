import type { ArticleStatus } from "@/lib/articles";

// Presentational status chip (slice-05 §3, extended slice-06 §4.4). Server
// Component — nothing interactive. DESIGN.md token discipline: `in_review` is the
// scarce signal worth gold, rendered navy-on-gold (accent-foreground on accent —
// the 8.13:1 inversion, never white-on-gold); `draft` is quiet navy-on-surface;
// `published` is white-on-navy (12.74:1) — solid/"live", deliberately NOT gold
// (gold means act-now/wayfinding, not a settled state); `unpublished` is muted
// slate-on-surface (forward, slice 08). The `testId` is supplied by the caller
// (`draft-status-badge`, `queue-item-status`, `review-status-badge`) so one
// component serves every surface.
const LABELS: Record<ArticleStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  unpublished: "Unpublished",
};

const TONES: Record<ArticleStatus, string> = {
  draft: "bg-surface text-brand border border-border",
  in_review: "bg-accent text-accent-foreground",
  published: "bg-brand text-header-foreground",
  unpublished: "bg-surface text-muted border border-border",
};

export function ArticleStatusBadge({
  status,
  testId,
  className = "",
}: {
  status: ArticleStatus;
  testId: string;
  className?: string;
}) {
  const tone = TONES[status];

  return (
    <span
      data-testid={testId}
      data-status={status}
      className={`inline-flex w-fit items-center rounded px-2 py-1 font-display text-xs font-semibold uppercase tracking-wide ${tone} ${className}`}
    >
      {LABELS[status]}
    </span>
  );
}
