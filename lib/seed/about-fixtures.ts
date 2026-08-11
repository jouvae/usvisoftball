import type {
  CreateBoardMemberInput,
  UpsertBoardTermInput,
  UpsertMissionInput,
} from "@/lib/board";

// Canonical seed fixtures for feature softball/about (Node 1 contract; APPLIED in
// Deliver). The seed script AND the about-web-001..003 specs import THIS module, so
// they can never drift — the same discipline as lib/seed/fixtures.ts for articles.
//
// `import type` above is erased at compile time, so importing this module never pulls
// the `server-only` fence from lib/board.ts. Photo URLs reuse the on-disk /seed/*.png
// files already committed under public/seed/; NO new image files are invented here.
// One current member is deliberately given NO photo (photoUrl omitted) to exercise the
// missing-photo state DESIGN.md requires — the roster's empty branch is a real fixture.

// H1: the mission singleton. Placeholder copy, clearly seed data; editable later
// through upsertMission without a schema change.
export const SEED_MISSION: UpsertMissionInput = {
  title: "Our Mission",
  body: "The USVI Softball Federation exists to grow softball across the Virgin Islands — fielding competitive teams for St. Thomas, St. John, and St. Croix, developing players and coaches at every level, and representing the territory with pride in regional and international play.",
};

// A term fixture bundles the term with its roster so the seed writes them together and
// the specs read a coherent aggregate. `members` carries everything but `termId`,
// which the seed fills in from the upserted term's id.
export interface SeedTerm {
  term: UpsertBoardTermInput;
  members: Omit<CreateBoardMemberInput, "termId">[];
}

// The CURRENT term (about-web-001/002). Covers ALL THREE island seats so about-web-002
// can assert full island coverage: St. Thomas/St. John · St. Croix · at-large.
const CURRENT_TERM: SeedTerm = {
  term: {
    slug: "2025-2027",
    label: "2025–2027", // en-dash display label; slug is the URL-safe key
    isCurrent: true,
    sortOrder: 20,
  },
  members: [
    {
      name: "Marlene Charles",
      seat: "at_large",
      role: "President",
      photoUrl: "/seed/team-profiles.png",
      bio: "Elected President for the 2025–2027 term, leading the Federation's territory-wide programs.",
      sortOrder: 0,
    },
    {
      name: "Delroy Richards",
      seat: "st_thomas_st_john",
      role: "Vice President",
      photoUrl: "/seed/team-profiles.png",
      bio: "Represents the St. Thomas / St. John district and oversees club development in the northern islands.",
      sortOrder: 1,
    },
    {
      name: "Yolanda Benjamin",
      seat: "st_croix",
      role: "Secretary",
      photoUrl: "/seed/team-profiles.png",
      bio: "Represents St. Croix and keeps the Federation's records and correspondence.",
      sortOrder: 2,
    },
    {
      // NO photoUrl → exercises the missing-photo state on a current-board card.
      name: "Terrence Gumbs",
      seat: "at_large",
      role: "Treasurer",
      bio: "Manages the Federation's finances and reporting across all districts.",
      sortOrder: 3,
    },
  ],
};

// A PRIOR (archived) term (about-web-003). isCurrent=false → the read-only archive.
// Smaller roster; its rows are never overwritten by the current term (H2 permanence).
const PRIOR_TERM: SeedTerm = {
  term: {
    slug: "2023-2025",
    label: "2023–2025",
    isCurrent: false,
    sortOrder: 10,
  },
  members: [
    {
      name: "Ivan Fredericks",
      seat: "at_large",
      role: "President",
      photoUrl: "/seed/team-profiles.png",
      bio: "Served as President for the 2023–2025 term.",
      sortOrder: 0,
    },
    {
      name: "Sandra Peters",
      seat: "st_croix",
      role: "Vice President",
      photoUrl: "/seed/team-profiles.png",
      bio: "Represented St. Croix on the 2023–2025 board.",
      sortOrder: 1,
    },
  ],
};

// Ordered current-first for readability; the seed writes both regardless of order.
export const SEED_BOARD_TERMS: SeedTerm[] = [CURRENT_TERM, PRIOR_TERM];
