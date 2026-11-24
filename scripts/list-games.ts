// Read-only: games around now, for the article-writer agent to pick an `event_slug`.
//
//   npm run -s article:games [-- --days 14] [--all]   (default: USVI games only)
//
// Prints one JSON array: slug, start (UTC + Virgin Islands time), teams, state, runs.
// Also lists the most recent articles so the agent doesn't repeat a headline.

import { createAdminClient } from "../lib/supabase/admin";

type Team = { name: string; country_code: string | null };
type Game = NonNullable<Row["games"]>;
// PostgREST embeds come back as an object or a one-element array depending on the FK.
const one = (g: Game | Game[] | null): Game | null =>
  Array.isArray(g) ? (g[0] ?? null) : g;

type Row = {
  slug: string;
  starts_at: string;
  venue: string;
  round: string;
  games: {
    state: string;
    away: Team | null;
    home: Team | null;
    game_innings: { side: string; runs: number }[];
  } | null;
};

async function main() {
  const i = process.argv.indexOf("--days");
  const days = i > -1 ? Number(process.argv[i + 1]) || 14 : 14;
  const now = Date.now();
  const from = new Date(now - days * 864e5).toISOString();
  const to = new Date(now + days * 864e5).toISOString();
  const db = createAdminClient();

  const { data, error } = await db
    .from("calendar_events")
    .select(
      "slug, starts_at, venue, round, games(state, away:teams!games_away_team_id_fkey(name, country_code), home:teams!games_home_team_id_fkey(name, country_code), game_innings(side, runs))",
    )
    .eq("type", "game")
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at");
  if (error) throw error;

  const vi = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/St_Thomas",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const all = process.argv.includes("--all");
  const isUsvi = (t?: Team | null) => t?.country_code === "VI";
  const games = ((data ?? []) as unknown as Row[])
    .filter((e) => {
      const g = one(e.games);
      return all || isUsvi(g?.away) || isUsvi(g?.home);
    })
    .map((e) => {
      const g = one(e.games);
      const runs = (side: string) =>
        g?.game_innings
          .filter((r) => r.side === side)
          .reduce((s, r) => s + r.runs, 0) ?? 0;
      return {
        event_slug: e.slug,
        starts_at_utc: e.starts_at,
        starts_at_vi: vi.format(new Date(e.starts_at)),
        venue: e.venue,
        round: e.round,
        away: g?.away?.name ?? null,
        home: g?.home?.name ?? null,
        state: g?.state ?? null,
        score:
          g && g.state !== "pregame" ? `${runs("away")}-${runs("home")}` : null,
      };
    });

  const recent = await db
    .from("articles")
    .select("slug, title, status, published_at")
    .order("updated_at", { ascending: false })
    .limit(10);
  if (recent.error) throw recent.error;

  console.log(JSON.stringify({ games, recentArticles: recent.data }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: (err as Error).message }));
  process.exit(1);
});
