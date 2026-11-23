// Results seed for the 2026 Central American and Caribbean Games women's softball (feature
// softball/schedule, scenario schedule-db-003; data in lib/seed/cacg-fixtures from the WBSC
// report). Unlike seed:panam this loads FINISHED games: state, hits/errors, line scores and the
// USVI box scores are part of the payload.
//
// Idempotent: every write is an UPSERT on a natural unique key — tournaments/teams/
// calendar_events by slug, team_players by (team_id, name), games by event_id, innings by
// (game_id, inning, side), stat lines by (game_id, player_id). Players are never deleted (D4).
//
// Bootstrap data written past RLS deliberately → the service-role admin client. Any error is
// fatal, and the final counts are asserted before exiting 0.
import { createAdminClient } from "../lib/supabase/admin";
import { countryName, eventSlug, localDateKey, slugify } from "../lib/schedule-view";
import { localToUtcIso } from "../lib/seed/panam-fixtures";
import {
  CACG_GAMES,
  CACG_GUEST_COUNTRIES,
  CACG_GUEST_DIVISION,
  CACG_TOURNAMENT,
  CACG_TOURNAMENT_SLUG,
  CACG_USVI_ROSTER,
  CACG_USVI_TEAM_SLUG,
  CACG_VENUE,
} from "../lib/seed/cacg-fixtures";

function must<T>(res: { data: T | null; error: unknown }, what: string): T {
  if (res.error) throw Object.assign(new Error(`${what} failed`), { cause: res.error });
  if (res.data == null) throw new Error(`${what} returned no data`);
  return res.data;
}

async function main(): Promise<void> {
  const admin = createAdminClient();
  const tz = CACG_TOURNAMENT.timezone;

  // ── Tournament ──
  const tournament = must(
    await admin
      .from("tournaments")
      .upsert({ slug: CACG_TOURNAMENT_SLUG, ...CACG_TOURNAMENT }, { onConflict: "slug" })
      .select("id,slug")
      .single(),
    "tournament upsert",
  ) as { id: string; slug: string };
  console.log(`  tournament ${tournament.slug}`);

  // ── Teams: USVI women (existing) + 7 guests upserted by slug ──
  const guests = CACG_GUEST_COUNTRIES.map((code) => {
    const name = `${countryName(code, "en")} Women`;
    return {
      name,
      slug: slugify(name),
      kind: "guest",
      country_code: code,
      division: CACG_GUEST_DIVISION,
      island: null,
    };
  });
  must(
    await admin.from("teams").upsert(guests, { onConflict: "slug" }).select("id"),
    "guest teams upsert",
  );
  const teamRows = must(
    await admin
      .from("teams")
      .select("id,slug,country_code")
      .in("slug", [CACG_USVI_TEAM_SLUG, ...guests.map((g) => g.slug)]),
    "team lookup",
  ) as { id: string; slug: string; country_code: string | null }[];
  const teamByCountry = new Map(teamRows.map((t) => [t.country_code ?? "", t.id]));
  if (teamRows.length !== 8 || teamByCountry.get("VI") === undefined) {
    throw new Error(`expected 8 CAC Games teams incl. USVI, resolved ${teamRows.length}`);
  }
  const usviTeamId = teamByCountry.get("VI")!;
  console.log(`  teams      ${teamRows.length} (USVI + ${guests.length} guests)`);

  // ── USVI roster (insert-or-update by team + name; never deleted) ──
  const players = must(
    await admin
      .from("team_players")
      .upsert(
        CACG_USVI_ROSTER.map((p) => ({
          team_id: usviTeamId,
          name: p.name,
          jersey_number: p.jersey,
          position: p.position,
          sort_order: p.jersey,
          active: true,
        })),
        { onConflict: "team_id,name" },
      )
      .select("id,name"),
    "USVI roster upsert",
  ) as { id: string; name: string }[];
  const playerByName = new Map(players.map((p) => [p.name, p.id]));
  console.log(`  players    ${players.length}`);

  // ── Calendar events, upserted by slug ──
  const events = CACG_GAMES.map((g) => {
    const startsAt = localToUtcIso(g.date, g.time, tz);
    if (localDateKey(startsAt, tz) !== g.date) throw new Error(`date drift for game ${g.no}`);
    return {
      tournament_id: tournament.id,
      type: "game",
      slug: eventSlug({ type: "game", awayCountryCode: g.away, homeCountryCode: g.home, localDate: g.date }),
      title: "",
      title_es: "",
      starts_at: startsAt,
      ends_at: g.durationMin ? new Date(Date.parse(startsAt) + g.durationMin * 60_000).toISOString() : null,
      venue: CACG_VENUE,
      round: g.round,
      sort_order: g.no,
    };
  });
  if (new Set(events.map((e) => e.slug)).size !== events.length) {
    throw new Error("duplicate event slugs in fixtures");
  }
  const savedEvents = must(
    await admin.from("calendar_events").upsert(events, { onConflict: "slug" }).select("id,slug"),
    "calendar_events upsert",
  ) as { id: string; slug: string }[];
  const eventIdBySlug = new Map(savedEvents.map((e) => [e.slug, e.id]));
  console.log(`  events     ${savedEvents.length}`);

  // ── Games: results final; medal games without a result keep their live state ──
  const gamePayload = CACG_GAMES.map((g, i) => {
    const base = {
      event_id: eventIdBySlug.get(events[i].slug)!,
      away_team_id: teamByCountry.get(g.away)!,
      home_team_id: teamByCountry.get(g.home)!,
    };
    if (!g.result) return base;
    return {
      ...base,
      state: "final",
      current_inning: Math.max(g.result.awayInnings.length, g.result.homeInnings.length),
      away_hits: g.result.awayHits,
      away_errors: g.result.awayErrors,
      home_hits: g.result.homeHits,
      home_errors: g.result.homeErrors,
    };
  });
  const finals = gamePayload.filter((g) => "state" in g);
  const pending = gamePayload.filter((g) => !("state" in g));
  const savedGames = [
    ...(must(
      await admin.from("games").upsert(finals, { onConflict: "event_id" }).select("id,event_id"),
      "final games upsert",
    ) as { id: string; event_id: string }[]),
    ...(must(
      await admin.from("games").upsert(pending, { onConflict: "event_id" }).select("id,event_id"),
      "pending games upsert",
    ) as { id: string; event_id: string }[]),
  ];
  const gameIdByEvent = new Map(savedGames.map((g) => [g.event_id, g.id]));
  console.log(`  games      ${savedGames.length} (${finals.length} final)`);

  // ── Line scores + USVI box scores ──
  const innings: { game_id: string; inning: number; side: string; runs: number }[] = [];
  const stats: Record<string, unknown>[] = [];
  CACG_GAMES.forEach((g, i) => {
    if (!g.result) return;
    const gameId = gameIdByEvent.get(gamePayload[i].event_id)!;
    g.result.awayInnings.forEach((runs, k) => innings.push({ game_id: gameId, inning: k + 1, side: "away", runs }));
    g.result.homeInnings.forEach((runs, k) => innings.push({ game_id: gameId, inning: k + 1, side: "home", runs }));
    for (const l of g.usvi) {
      const playerId = playerByName.get(l.player);
      if (!playerId) throw new Error(`game ${g.no}: unknown player ${l.player}`);
      stats.push({
        game_id: gameId,
        player_id: playerId,
        team_id: usviTeamId,
        ab: l.ab, r: l.r, h: l.h, doubles: l.doubles, triples: l.triples, hr: l.hr,
        rbi: l.rbi, bb: l.bb, so: l.so, sb: l.sb,
        outs_pitched: l.pitching?.outsPitched ?? null,
        p_h: l.pitching?.h ?? null,
        p_r: l.pitching?.r ?? null,
        p_er: l.pitching?.er ?? null,
        p_bb: l.pitching?.bb ?? null,
        p_so: l.pitching?.so ?? null,
      });
    }
  });
  const savedInnings = must(
    await admin.from("game_innings").upsert(innings, { onConflict: "game_id,inning,side" }).select("game_id"),
    "innings upsert",
  ) as unknown[];
  const savedStats = must(
    await admin.from("game_player_stats").upsert(stats, { onConflict: "game_id,player_id" }).select("id"),
    "stat lines upsert",
  ) as unknown[];
  console.log(`  innings    ${savedInnings.length}`);
  console.log(`  stat lines ${savedStats.length}`);

  if (savedEvents.length !== 22 || savedGames.length !== 22 || players.length !== 15) {
    throw new Error(
      `expected 22 events / 22 games / 15 players, got ${savedEvents.length} / ${savedGames.length} / ${players.length}`,
    );
  }
  console.log("seed:cacg complete");
}

main().catch((err) => {
  console.error("seed:cacg failed:", err);
  process.exit(1);
});
