"use client";

import { useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import Image from "next/image";
import type { BoardMember, BoardSocialPlatform } from "@/lib/board-view";
import {
  BOARD_SOCIAL_PLATFORMS,
  BOARD_SOCIAL_LABELS,
  safeBoardSocialHref,
} from "@/lib/board-view";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
} from "@/components/ui/social-icons";

const SOCIAL_ICONS: Record<BoardSocialPlatform, ComponentType<SVGProps<SVGSVGElement>>> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  x: XIcon,
};

// The /about board grid + profile modal. CLIENT island. Layout follows the "Meet our
// leadership" team section (components/samples/board-member-section.tsx): a centered grid
// of large round headshots with the name, the office, and the member's social icons below.
// The headshot + name + office are one button that opens a native <dialog> profile modal
// (photo, name, office, bio, social links); the social icons sit OUTSIDE that button
// because a link can't nest inside a button. The island seat is not shown publicly: the
// current roster's seats are not confirmed (every member is stored at-large for now).
// Native <dialog> gives us a
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
        className="mx-auto grid max-w-2xl grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-8 sm:gap-y-14 lg:max-w-none lg:grid-cols-4"
      >
        {members.map((m) => (
          <li key={m.id} className="flex flex-col items-center text-center">
            <button
              type="button"
              data-testid="board-grid-card"
              data-member-id={m.id}
              onClick={() => setOpen(m)}
              className="group flex flex-col items-center rounded-2xl p-2 outline-focus focus:outline-2 focus:outline-offset-4"
            >
              <Avatar
                member={m}
                sizes="(min-width: 640px) 192px, 128px"
                className="size-32 ring-4 ring-transparent ring-offset-4 transition-shadow group-hover:ring-accent sm:size-48 motion-reduce:transition-none"
              />
              <span
                data-testid="board-grid-name"
                className="mt-4 font-display text-lg font-bold leading-tight tracking-tight text-navy sm:mt-6 sm:text-xl"
              >
                {m.name}
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted sm:text-sm">
                {m.role}
              </span>
            </button>
            <SocialIconLinks member={m} />
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
                <Avatar member={open} sizes="96px" className="size-24" />
                <div className="flex flex-col gap-1">
                  <h2
                    data-testid="board-modal-name"
                    className="font-display text-2xl font-bold leading-tight text-navy"
                  >
                    {open.name}
                  </h2>
                  <p
                    data-testid="board-modal-role"
                    className="text-sm font-semibold uppercase tracking-wide text-muted"
                  >
                    {open.role}
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
  sizes,
  className = "",
}: {
  member: BoardMember;
  sizes: string;
  className?: string;
}) {
  return (
    <span
      data-testid="board-grid-avatar"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy outline-1 -outline-offset-1 outline-black/5 ${className}`}
    >
      {member.photoUrl ? (
        <Image
          data-testid="board-grid-photo"
          src={member.photoUrl}
          alt={`${member.name}, ${member.role}`}
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-display text-4xl font-bold uppercase tracking-tight text-accent"
        >
          {initials(member.name)}
        </span>
      )}
    </span>
  );
}

// Every platform the member links to, each href guarded at render (https + allowlisted
// host). Empty when the member has no valid link.
function validSocials(member: BoardMember) {
  return BOARD_SOCIAL_PLATFORMS.map((platform) => ({
    platform,
    href: safeBoardSocialHref(member.socials[platform], platform),
  })).filter((l) => l.href !== "");
}

// The card's row of social icons (the sample layout's icon row). Each link names the
// member and platform for screen readers. Renders nothing for a member with no links.
function SocialIconLinks({ member }: { member: BoardMember }) {
  const links = validSocials(member);
  if (links.length === 0) return null;

  return (
    <ul role="list" data-testid="board-grid-socials" className="mt-4 flex justify-center gap-x-5">
      {links.map(({ platform, href }) => {
        const Icon = SOCIAL_ICONS[platform];
        return (
          <li key={platform}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted outline-focus hover:text-brand focus:outline-2"
            >
              <span className="sr-only">
                {member.name} on {BOARD_SOCIAL_LABELS[platform]}
              </span>
              <Icon aria-hidden="true" className="size-5" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// The member's social links, each guarded at render. Renders nothing when the member has
// no valid link — so a member without socials shows no empty row.
function SocialLinks({ member }: { member: BoardMember }) {
  const links = validSocials(member);
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
