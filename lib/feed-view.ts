import type { ArticleListItem } from "@/lib/articles";
import {
  ATLANTIC_TZ,
  SOFTBALL_INNINGS,
  isUsviTeam,
  runTotals,
  teamDisplayName,
  type GameWithTeams,
  type Locale,
} from "@/lib/schedule-view";

// ---------------------------------------------------------------------------
// Feature softball/home-feed — client-safe types + pure helpers for the ESPN-style home feed
// (docs/features/softball/home-feed/overview.md). No I/O: the server reads live in lib/feed.ts.
// ---------------------------------------------------------------------------

// The feed's page size (H5) and how many pages load on scroll before only the button loads.
export const FEED_PAGE_SIZE = 8;
export const FEED_AUTO_PAGES = 3;
export const HIGHLIGHTS_LIMIT = 12;

// The score bar on a recap linked to a game (H9): both teams, R, and the game's state.
export interface StoryScore {
  away: string;
  home: string;
  awayRuns: number;
  homeRuns: number;
  state: GameWithTeams["state"];
  eventSlug: string;
}

// One story in the feed: an article list item plus its optional recap score.
export interface FeedStory extends ArticleListItem {
  isHighlight: boolean;
  score: StoryScore | null;
}

// A page of stories plus the cursor for the next one (null = the feed is exhausted).
export interface FeedPage {
  stories: FeedStory[];
  nextCursor: string | null;
}

// One rail item, ready to render. `final` items carry the game; `manual` items carry text.
export type HighlightItem =
  | { id: string; kind: "manual"; publishedAt: string; text: string; linkUrl: string | null }
  | {
      id: string;
      kind: "game_final";
      publishedAt: string;
      line: FinalLine;
      eventSlug: string;
      tournament: string;
    };

// ── Keyset cursor on (published_at, id) ─────────────────────────────────────────

export interface FeedCursor {
  publishedAt: string;
  id: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Opaque to the client. base64url of "iso|uuid".
export function encodeFeedCursor(c: FeedCursor): string {
  return btoa(`${c.publishedAt}|${c.id}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// The cursor arrives from the query string, so it is validated before it reaches a filter:
// a real ISO instant and a uuid, or null.
export function decodeFeedCursor(raw: string | null | undefined): FeedCursor | null {
  if (!raw) return null;
  let text: string;
  try {
    text = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
  const [publishedAt, id, ...rest] = text.split("|");
  if (rest.length || !publishedAt || !id || !UUID_RE.test(id)) return null;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return null;
  return { publishedAt: new Date(t).toISOString(), id };
}

// ── Lead story (H4) ─────────────────────────────────────────────────────────────

// Newest-first input → the newest featured story, else the newest story.
export function pickLead<T extends { isHighlight: boolean }>(stories: readonly T[]): T | null {
  return stories.find((s) => s.isHighlight) ?? stories[0] ?? null;
}

// ── Highlights ──────────────────────────────────────────────────────────────────

export interface FinalLine {
  winner: string;
  winnerRuns: number;
  loser: string;
  loserRuns: number;
  innings: number | null; // only when the game went past regulation
  usviWon: boolean;
}

// A final game as "winner R, loser R" (localized team names). A tie can't be final in softball;
// if one ever reaches here, home is listed first.
export function finalHighlightLine(game: GameWithTeams, locale: Locale): FinalLine {
  const r = runTotals(game.innings);
  const awayWon = r.away > r.home;
  const [w, l] = awayWon ? [game.away, game.home] : [game.home, game.away];
  const played = game.innings.reduce((n, i) => Math.max(n, i.inning), 0);
  return {
    winner: teamDisplayName(w, locale),
    winnerRuns: awayWon ? r.away : r.home,
    loser: teamDisplayName(l, locale),
    loserRuns: awayWon ? r.home : r.away,
    innings: played > SOFTBALL_INNINGS ? played : null,
    usviWon: isUsviTeam(w),
  };
}

// https:// or a site path. Mirrors the 0029 CHECK; the form validates with this first.
export function isAllowedHighlightLink(url: string): boolean {
  if (url.startsWith("/")) return !url.startsWith("//");
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

// "40 minutes ago" / "3 hours ago" inside a day, then a short date in USVI time ("Nov 21"; the
// year only when it isn't this year).
export function relativeTimeLabel(iso: string, now: Date, locale: Locale): string {
  const diffMin = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
  if (diffMin >= 0 && diffMin < 24 * 60) {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
    return diffMin < 60 ? rtf.format(-Math.max(diffMin, 1), "minute") : rtf.format(-Math.floor(diffMin / 60), "hour");
  }
  const sameYear =
    new Intl.DateTimeFormat("en", { year: "numeric", timeZone: ATLANTIC_TZ }).format(new Date(iso)) ===
    new Intl.DateTimeFormat("en", { year: "numeric", timeZone: ATLANTIC_TZ }).format(now);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    timeZone: ATLANTIC_TZ,
  })
    .format(new Date(iso))
    .replace(".", "");
}

// ── Manual highlights (admin) ───────────────────────────────────────────────────

export interface ManualHighlight {
  id: string;
  textEn: string;
  textEs: string;
  linkUrl: string | null;
  isPublished: boolean;
  publishedAt: string;
}

export interface HighlightInput {
  textEn: string;
  textEs: string;
  linkUrl: string | null;
  isPublished: boolean;
}

// Mirrors the 0029 CHECK (1–200 characters, both languages).
export const HIGHLIGHT_TEXT_MAX = 200;
