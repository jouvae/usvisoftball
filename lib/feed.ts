import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import { listFeedArticles, type FeedArticle } from "@/lib/articles";
import { listEventsByGameIds } from "@/lib/schedule";
import { gameRunTotals, teamDisplayName, type EventWithGame, type Locale } from "@/lib/schedule-view";
import {
  FEED_PAGE_SIZE,
  HIGHLIGHTS_LIMIT,
  encodeFeedCursor,
  finalHighlightLine,
  isAllowedHighlightLink,
  pickLead,
  type FeedCursor,
  type FeedPage,
  type FeedStory,
  type HighlightInput,
  type HighlightItem,
  type ManualHighlight,
} from "@/lib/feed-view";

export * from "@/lib/feed-view";

// ---------------------------------------------------------------------------
// Feature softball/home-feed — server reads for the home feed and the highlights rail, and the
// editor writes for manual highlights (migration 0029).
//
// SERVER ONLY. Public reads use the RLS-enforced publishable client (published rows only).
// Admin reads/writes take the editor's cookie session client — the 0029 editor policies are the
// real boundary. Client-safe types + pure helpers live in lib/feed-view.ts (re-exported).
// ---------------------------------------------------------------------------

// Attach recap score bars: one read for every linked game on the page.
async function withScores(articles: FeedArticle[], locale: Locale): Promise<FeedStory[]> {
  const gameIds = [...new Set(articles.map((a) => a.gameId).filter((id): id is string => !!id))];
  const events = await listEventsByGameIds(gameIds);
  const byGame = new Map(events.filter((e) => e.game).map((e) => [e.game!.id, e]));
  return articles.map(({ gameId, ...a }) => {
    const e = gameId ? byGame.get(gameId) : undefined;
    if (!e?.game) return { ...a, score: null };
    const r = gameRunTotals(e.game);
    return {
      ...a,
      score: {
        away: teamDisplayName(e.game.away, locale),
        home: teamDisplayName(e.game.home, locale),
        awayRuns: r.away,
        homeRuns: r.home,
        state: e.game.state,
        eventSlug: e.slug,
      },
    };
  });
}

function pageOf(stories: FeedStory[], limit: number): FeedPage {
  const last = stories.at(-1);
  return {
    stories,
    nextCursor:
      stories.length === limit && last?.publishedAt
        ? encodeFeedCursor({ publishedAt: last.publishedAt, id: last.id })
        : null,
  };
}

// The home's first render: the lead story (H4) and the first page of everything else.
export async function getHomeFeed(
  locale: Locale,
): Promise<{ lead: FeedStory | null; page: FeedPage }> {
  const [featured, newest] = await Promise.all([
    listFeedArticles({ limit: 1, featuredOnly: true }),
    listFeedArticles({ limit: 1 }),
  ]);
  const leadArticle = pickLead([...featured, ...newest]);
  const first = await listFeedArticles({ limit: FEED_PAGE_SIZE, excludeId: leadArticle?.id });
  const [lead] = leadArticle ? await withScores([leadArticle], locale) : [null];
  return { lead, page: pageOf(await withScores(first, locale), FEED_PAGE_SIZE) };
}

// The next page after `cursor`, never repeating the lead.
export async function getFeedPage(
  cursor: FeedCursor,
  excludeId: string | null,
  locale: Locale,
): Promise<FeedPage> {
  const rows = await listFeedArticles({ limit: FEED_PAGE_SIZE, after: cursor, excludeId });
  return pageOf(await withScores(rows, locale), FEED_PAGE_SIZE);
}

// Stories published after `since` (the "N new stories" pill, H6). Capped.
export async function getNewerStories(since: string, locale: Locale): Promise<FeedStory[]> {
  return withScores(await listFeedArticles({ limit: 20, newerThan: since }), locale);
}

// ── Highlights ──────────────────────────────────────────────────────────────────

type HighlightRow = {
  id: string;
  kind: "manual" | "game_final";
  text_en: string;
  text_es: string;
  link_url: string | null;
  game_id: string | null;
  is_published: boolean;
  published_at: string;
};

const HIGHLIGHT_COLUMNS = "id,kind,text_en,text_es,link_url,game_id,is_published,published_at";

function tournamentName(e: EventWithGame, locale: Locale): string {
  const t = e.tournament;
  if (!t) return "";
  return locale === "es" && t.nameEs ? t.nameEs : t.name;
}

// The rail (H7): published highlights newest-first. Final rows are rendered from their game,
// so a corrected score shows corrected; a final whose game is no longer final is skipped.
export async function listHighlights(locale: Locale, limit = HIGHLIGHTS_LIMIT): Promise<HighlightItem[]> {
  const { data, error } = await createPublicClient()
    .from("home_highlights")
    .select(HIGHLIGHT_COLUMNS)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data as HighlightRow[] | null) ?? [];
  const events = await listEventsByGameIds(rows.flatMap((r) => (r.game_id ? [r.game_id] : [])));
  const byGame = new Map(events.filter((e) => e.game).map((e) => [e.game!.id, e]));

  const items: HighlightItem[] = [];
  for (const r of rows) {
    if (r.kind === "manual") {
      items.push({
        id: r.id,
        kind: "manual",
        publishedAt: r.published_at,
        text: locale === "es" ? r.text_es : r.text_en,
        linkUrl: r.link_url && isAllowedHighlightLink(r.link_url) ? r.link_url : null,
      });
      continue;
    }
    const e = r.game_id ? byGame.get(r.game_id) : undefined;
    if (!e?.game || e.game.state !== "final") continue;
    items.push({
      id: r.id,
      kind: "game_final",
      publishedAt: r.published_at,
      line: finalHighlightLine(e.game, locale),
      eventSlug: e.slug,
      tournament: tournamentName(e, locale),
    });
  }
  return items;
}

// The newest published highlight's timestamp — the poll compares it to re-render the rail.
export async function latestHighlightAt(): Promise<string | null> {
  const { data, error } = await createPublicClient()
    .from("home_highlights")
    .select("published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { published_at: string } | null)?.published_at ?? null;
}

// ── Admin (editor session client) ───────────────────────────────────────────────


// Every manual highlight (drafts included — the 0029 editor-read policy), newest first. Auto
// finals are not edited here: they follow their game.
export async function listManualHighlights(supabase: SupabaseClient): Promise<ManualHighlight[]> {
  const { data, error } = await supabase
    .from("home_highlights")
    .select(HIGHLIGHT_COLUMNS)
    .eq("kind", "manual")
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data as HighlightRow[] | null) ?? []).map((r) => ({
    id: r.id,
    textEn: r.text_en,
    textEs: r.text_es,
    linkUrl: r.link_url,
    isPublished: r.is_published,
    publishedAt: r.published_at,
  }));
}

function toRow(input: HighlightInput) {
  return {
    kind: "manual" as const,
    text_en: input.textEn,
    text_es: input.textEs,
    link_url: input.linkUrl,
    is_published: input.isPublished,
  };
}

export async function createHighlight(input: HighlightInput, supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.from("home_highlights").insert(toRow(input)).select("id").single();
  if (error) throw error;
}

export async function updateHighlight(
  id: string,
  input: HighlightInput,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase
    .from("home_highlights")
    .update(toRow(input))
    .eq("id", id)
    .eq("kind", "manual")
    .select("id")
    .single();
  if (error) throw error;
}

export async function deleteHighlight(id: string, supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.from("home_highlights").delete().eq("id", id).eq("kind", "manual");
  if (error) throw error;
}
