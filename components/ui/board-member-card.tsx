import Image from "next/image";
import type { BoardSeat } from "@/lib/board";
import { SEAT_LABELS } from "@/lib/board";

// The fields a roster card renders. Matches the fixture member shape
// (Omit<CreateBoardMemberInput,"termId">) and the DB-backed BoardMember alike, so the
// current roster and the archived-term roster share one card.
export type BoardMemberCardData = {
  name: string;
  seat: BoardSeat;
  role: string;
  photoUrl?: string | null;
  bio?: string;
};

export type BoardMemberCardProps = {
  member: BoardMemberCardData;
  className?: string;
};

// Initials for the missing-photo fallback (DESIGN.md empty state). First letter of the
// first two words, upper-cased — a legible placeholder when photoUrl is null.
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

// One board member. Server Component — nothing here is interactive. The seat renders as
// a human label (SEAT_LABELS is the single source of truth, so the roster and the
// about-web-002 assertion never drift). Missing photo → a navy initials block.
export function BoardMemberCard({ member, className = "" }: BoardMemberCardProps) {
  const { name, seat, role, photoUrl, bio } = member;

  return (
    <li
      data-testid="board-member-card"
      className={`flex flex-col overflow-hidden rounded-lg border border-border bg-background ${className}`}
    >
      {/* `fill` requires a positioned parent (image.md §fill). */}
      <div
        data-testid="board-member-photo"
        className="relative flex aspect-square items-center justify-center bg-brand"
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`${name}, ${role}`}
            fill
            sizes="(min-width: 768px) 25vw, 100vw"
            className="object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="font-display text-4xl font-bold uppercase tracking-tight text-accent"
          >
            {initials(name)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <span
          data-testid="board-member-seat"
          className="inline-flex w-fit items-center rounded bg-accent px-2 py-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-foreground"
        >
          {SEAT_LABELS[seat]}
        </span>

        <h3
          data-testid="board-member-name"
          className="font-display text-xl font-bold leading-tight tracking-tight text-brand"
        >
          {name}
        </h3>

        <p
          data-testid="board-member-role"
          className="text-sm font-semibold uppercase tracking-wide text-muted"
        >
          {role}
        </p>

        {bio ? (
          <p data-testid="board-member-bio" className="text-sm text-foreground">
            {bio}
          </p>
        ) : null}
      </div>
    </li>
  );
}
