"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { BoardMember } from "@/lib/board-view";
import {
  SEAT_LABELS,
  BOARD_SOCIAL_PLATFORMS,
  BOARD_SOCIAL_LABELS,
  safeBoardSocialHref,
} from "@/lib/board-view";

// The home board grid + profile modal (MVP slice 5). CLIENT island: the grid is a list of
// buttons (avatar + name + role); clicking one opens a native <dialog> profile modal with
// the member's photo, name, role, seat, bio, and social links. Native <dialog> gives us a
// real focus trap + Esc-to-close + backdrop for free. Social hrefs pass through
// safeBoardSocialHref at render, so only https links on an allowlisted platform host ever
// become live <a> tags (defense-in-depth against a stored javascript:/off-platform URL).
export function BoardGrid({ members }: { members: BoardMember[] }) {
  const [open, setOpen] = useState<BoardMember | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Drive the native dialog imperatively from React state (showModal/close are not
  // controllable via props). Keep them in lockstep with `open`.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => setOpen(null);

  return (
    <>
      <ul
        role="list"
        data-testid="board-grid"
        className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4"
      >
        {members.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              data-testid="board-grid-card"
              data-member-id={m.id}
              onClick={() => setOpen(m)}
              className="flex w-full flex-col items-center gap-3 rounded-lg border border-border bg-background p-5 text-center outline-focus transition-colors hover:border-brand focus:outline-2"
            >
              <Avatar member={m} className="h-24 w-24" />
              <span className="flex flex-col gap-1">
                <span
                  data-testid="board-grid-name"
                  className="font-display text-base font-bold leading-tight text-brand"
                >
                  {m.name}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {m.role}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        data-testid="board-modal"
        onClose={close}
        // Close when the backdrop (the dialog element itself, outside the inner panel)
        // is clicked. Clicks on the panel don't reach here because the panel stops them.
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto w-[92vw] max-w-lg rounded-lg border border-border bg-background p-0 backdrop:bg-black/50"
      >
        {open ? (
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar member={open} className="h-20 w-20" />
                <div className="flex flex-col gap-1">
                  <h2
                    data-testid="board-modal-name"
                    className="font-display text-2xl font-bold leading-tight text-brand"
                  >
                    {open.name}
                  </h2>
                  <p
                    data-testid="board-modal-role"
                    className="text-sm font-semibold uppercase tracking-wide text-muted"
                  >
                    {open.role}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {SEAT_LABELS[open.seat]}
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="board-modal-close"
                onClick={close}
                aria-label="Close"
                className="rounded-md px-2 py-1 text-2xl leading-none text-muted outline-focus hover:text-brand focus:outline-2"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            {open.bio ? (
              <p
                data-testid="board-modal-bio"
                className="whitespace-pre-wrap text-sm text-foreground"
              >
                {open.bio}
              </p>
            ) : null}

            <SocialLinks member={open} />
          </div>
        ) : null}
      </dialog>
    </>
  );
}

// Initials fallback for a missing photo (mirrors BoardMemberCard's empty state).
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function Avatar({
  member,
  className = "",
}: {
  member: BoardMember;
  className?: string;
}) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand ${className}`}
    >
      {member.photoUrl ? (
        <Image
          src={member.photoUrl}
          alt={`${member.name}, ${member.role}`}
          fill
          sizes="96px"
          className="object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-display text-xl font-bold uppercase tracking-tight text-accent"
        >
          {initials(member.name)}
        </span>
      )}
    </span>
  );
}

// The member's social links, each guarded at render. Renders nothing when the member has
// no valid link — so a member without socials shows no empty row.
function SocialLinks({ member }: { member: BoardMember }) {
  const links = BOARD_SOCIAL_PLATFORMS.map((platform) => ({
    platform,
    href: safeBoardSocialHref(member.socials[platform], platform),
  })).filter((l) => l.href !== "");

  if (links.length === 0) return null;

  return (
    <ul
      role="list"
      data-testid="board-modal-socials"
      className="flex flex-wrap gap-3"
    >
      {links.map(({ platform, href }) => (
        <li key={platform}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`board-modal-social-${platform}`}
            className="inline-flex items-center rounded-full border border-brand px-3 py-1 text-sm font-medium text-brand outline-focus hover:bg-surface focus:outline-2"
          >
            {BOARD_SOCIAL_LABELS[platform]}
          </a>
        </li>
      ))}
    </ul>
  );
}
