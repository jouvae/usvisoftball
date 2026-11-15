// Canonical seed for the 2026 U18 Women's Pan Am opening round (feature softball/schedule,
// slice S1, scenario schedule-db-002; data per overview §3 via lib/seed/panam-fixtures).
//
// Idempotent: every write is an UPSERT keyed by a natural unique key — tournaments/teams/
// calendar_events by slug, games by event_id — so a re-run converges instead of duplicating.
// Live data is never reset: event `status` and game `state`/hits/errors are NOT in the upsert
// payloads (inserts take the column defaults 'scheduled' / 'pregame'; updates leave them).
// Legacy `events` / `event_teams` are not touched.
//
// Bootstrap data written past RLS deliberately → the service-role admin client. Any error is
// fatal (no swallowing), and the final counts are asserted before exiting 0.
//
// Relative imports (not `@/…`) so the standalone runner resolves cleanly.
import { createAdminClient } from "../lib/supabase/admin";
import { countryName, eventSlug, localDateKey, slugify } from "../lib/schedule-view";
import {
  GUEST_DIVISION,
  PANAM_CEREMONY,
  PANAM_GAMES,
  PANAM_GUEST_COUNTRIES,
  PANAM_ROUND,
  PANAM_TOURNAMENT,
  PANAM_TOURNAMENT_SLUG,
  USVI_TEAM_SLUG,
  localToUtcIso,
} from "../lib/seed/panam-fixtures";

function must<T>(res: { data: T | null; error: unknown }, what: string): T {
  if (res.error) throw Object.assign(new Error(`${what} failed`), { cause: res.error });
  if (res.data == null) throw new Error(`${what} returned no data`);
  return res.data;
}

async function main(): Promise<void> {
  const admin = createAdminClient();
  const tz = PANAM_TOURNAMENT.timezone;

  // ── Tournament (row copied from legacy by 0026; update in place) ──
  const tournament = must(
    await admin
      .from("tournaments")
      .update(PANAM_TOURNAMENT)
      .eq("slug", PANAM_TOURNAMENT_SLUG)
      .select("id,slug")
      .single(),
    "tournament update",
  ) as { id: string; slug: string };
  console.log(`  tournament ${tournament.slug}`);

  // ── Teams: USVI gets 'VI'; 17 guests upserted by slug ──
  must(
    await admin
      .from("teams")
      .update({ country_code: "VI" })
      .in("slug", [USVI_TEAM_SLUG, "womens-national-team"])
      .select("id"),
    "USVI country_code",
  );

  const guests = PANAM_GUEST_COUNTRIES.map((code) => {
    const name = `${countryName(code, "en")} U18 Women`;
    return {
      name,
      slug: slugify(name),
      kind: "guest",
      country_code: code,
      division: GUEST_DIVISION,
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
      .in("slug", [USVI_TEAM_SLUG, ...guests.map((g) => g.slug)]),
    "team lookup",
  ) as { id: string; slug: string; country_code: string }[];
  const teamByCountry = new Map<string, string>();
  for (const t of teamRows) {
    if (t.slug === USVI_TEAM_SLUG || PANAM_GUEST_COUNTRIES.includes(t.country_code as never)) {
      teamByCountry.set(t.country_code, t.id);
    }
  }
  if (teamByCountry.size !== 18) {
    throw new Error(`expected 18 Pan Am teams, resolved ${teamByCountry.size}`);
  }
  console.log(`  teams      ${teamByCountry.size} (USVI + ${guests.length} guests)`);

  // ── Calendar events: ceremony + 32 games, upserted by slug ──
  const ceremony = {
    tournament_id: tournament.id,
    type: "ceremony",
    slug: eventSlug({ type: "ceremony", tournamentSlug: tournament.slug, title: PANAM_CEREMONY.title }),
    title: PANAM_CEREMONY.title,
    title_es: PANAM_CEREMONY.titleEs,
    starts_at: localToUtcIso(PANAM_CEREMONY.date, PANAM_CEREMONY.time, tz),
    venue: PANAM_CEREMONY.venue,
    round: PANAM_ROUND,
  };
  const gameEvents = PANAM_GAMES.map((g) => {
    const startsAt = localToUtcIso(g.date, g.time, tz);
    if (localDateKey(startsAt, tz) !== g.date) throw new Error(`date drift for ${g.date} ${g.time}`);
    return {
      tournament_id: tournament.id,
      type: "game",
      slug: eventSlug({ type: "game", awayCountryCode: g.away, homeCountryCode: g.home, localDate: g.date }),
      title: "", // games are titled from their teams
      title_es: "",
      starts_at: startsAt,
      venue: g.venue,
      round: PANAM_ROUND,
    };
  });
  const allEvents = [ceremony, ...gameEvents];
  if (new Set(allEvents.map((e) => e.slug)).size !== allEvents.length) {
    throw new Error("duplicate event slugs in fixtures");
  }
  const savedEvents = must(
    await admin.from("calendar_events").upsert(allEvents, { onConflict: "slug" }).select("id,slug"),
    "calendar_events upsert",
  ) as { id: string; slug: string }[];
  const eventIdBySlug = new Map(savedEvents.map((e) => [e.slug, e.id]));
  console.log(`  events     ${savedEvents.length} (1 ceremony + ${gameEvents.length} games)`);

  // ── Games: one per game event, upserted by event_id ──
  const games = PANAM_GAMES.map((g, i) => ({
    event_id: eventIdBySlug.get(gameEvents[i].slug)!,
    away_team_id: teamByCountry.get(g.away)!,
    home_team_id: teamByCountry.get(g.home)!,
  }));
  const savedGames = must(
    await admin.from("games").upsert(games, { onConflict: "event_id" }).select("id"),
    "games upsert",
  ) as { id: string }[];
  console.log(`  games      ${savedGames.length}`);

  if (savedEvents.length !== 33 || savedGames.length !== 32) {
    throw new Error(`expected 33 events / 32 games, got ${savedEvents.length} / ${savedGames.length}`);
  }
  console.log("seed:panam complete");
}

main().catch((err) => {
  console.error("seed:panam failed:", err);
  process.exit(1);
});
