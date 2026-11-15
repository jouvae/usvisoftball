import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  getEventBySlug,
  eventDisplayTitle,
  formatEventDate,
  formatEventTime,
  runTotals,
  teamDisplayName,
  timeZoneLabel,
  type GameWithTeams,
} from "@/lib/schedule";

// The per-event share image (D8): 1200×630 PNG — navy field, gold accents, both teams with
// their country codes, the venue-local date/time with its zone, the tournament, and the final
// score once the game is over. Oswald is vendored as static TTF instances (app/fonts; satori
// can't read woff2) and read from disk, so rendering needs no network. Country codes stand in
// for flag emoji: satori draws emoji only from a CDN-fetched image set.
// force-dynamic: rendered per request from Supabase — never at the env-free build.
export const dynamic = "force-dynamic";
export const alt = "USVI Softball Federation event";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0a2557";
const NAVY_RAISED = "#13336f";
const GOLD = "#f7cf4f";
const MUTED = "#c8d3ea";

function fonts() {
  const dir = join(process.cwd(), "app/fonts");
  return Promise.all([
    readFile(join(dir, "oswald-bold.ttf")),
    readFile(join(dir, "oswald-medium.ttf")),
  ]);
}

function TeamLine({
  game,
  side,
  score,
}: {
  game: GameWithTeams;
  side: "away" | "home";
  score: number | null;
}) {
  const team = game[side];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 104,
          height: 72,
          borderRadius: 12,
          border: `4px solid ${GOLD}`,
          color: GOLD,
          fontSize: 40,
          fontWeight: 700,
        }}
      >
        {team.countryCode ?? "—"}
      </div>
      <div style={{ display: "flex", flex: 1, fontSize: 76, fontWeight: 700, lineHeight: 1 }}>
        {teamDisplayName(team, "en")}
      </div>
      {score != null ? (
        <div style={{ display: "flex", fontSize: 92, fontWeight: 700, color: GOLD }}>{score}</div>
      ) : null}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [event, [bold, medium]] = await Promise.all([getEventBySlug(slug), fonts()]);

  const tz = event?.timezone ?? "UTC";
  const game = event?.game ?? null;
  const final = game?.state === "final";
  const totals = game ? runTotals(game.innings) : null;
  const tournament = event?.tournamentDetail?.name ?? event?.tournament?.name ?? "";
  const when = event
    ? `${formatEventDate(event.startsAt, tz, "en")} · ${formatEventTime(event.startsAt, tz, "en")} ${timeZoneLabel(event.startsAt, tz, "en")}`
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: NAVY,
          color: "#ffffff",
          fontFamily: "Oswald",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14, background: GOLD }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 150,
            height: 630,
            background: NAVY_RAISED,
            clipPath: "polygon(60% 0, 100% 0, 100% 100%, 0 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 110,
            width: 60,
            height: 630,
            background: GOLD,
            clipPath: "polygon(70% 0, 100% 0, 30% 100%, 0 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 220px 56px 72px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", width: 72, height: 8, borderRadius: 4, background: GOLD }} />
            <div
              style={{
                display: "flex",
                fontSize: 34,
                fontWeight: 500,
                color: GOLD,
                textTransform: "uppercase",
                letterSpacing: 3,
              }}
            >
              {tournament || "USVI Softball Federation"}
            </div>
          </div>

          {game ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <TeamLine game={game} side="away" score={final && totals ? totals.away : null} />
              <div style={{ display: "flex", fontSize: 30, color: MUTED, paddingLeft: 132 }}>
                {final ? "FINAL" : "VS"}
              </div>
              <TeamLine game={game} side="home" score={final && totals ? totals.home : null} />
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
              {event ? eventDisplayTitle(event, "en") : "Schedule"}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 500 }}>{when}</div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 500, color: MUTED }}>
              {event ? `${event.venue} · usvisoftball.org` : "usvisoftball.org"}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Oswald", data: bold, weight: 700, style: "normal" },
        { name: "Oswald", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
