import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  getEventBySlug,
  eventDisplayTitle,
  gameWinner,
  ogWhenLine,
  runTotals,
  teamDisplayName,
  type GameWithTeams,
} from "@/lib/schedule";

// The per-event share image (D8): 1200×630 PNG — navy field, gold accents, both teams with
// their country codes, the date with venue-local time ("local") AND Atlantic time (AST — the
// USVI audience), the tournament, and — once final — a big gold score per team plus a FINAL
// banner, with the winner at full strength and the loser dimmed. Oswald is vendored as static TTF instances (app/fonts; satori
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
  dim = false,
}: {
  game: GameWithTeams;
  side: "away" | "home";
  score: number | null;
  dim?: boolean;
}) {
  const team = game[side];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: dim ? 0.6 : 1 }}>
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
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 700,
            lineHeight: 1,
            color: GOLD,
            minWidth: 110,
            justifyContent: "flex-end",
          }}
        >
          {score}
        </div>
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
  const when = event ? ogWhenLine(event.startsAt, tz) : "";
  const winner = game && totals ? gameWinner(game, totals) : null;

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
              <TeamLine
                game={game}
                side="away"
                score={final && totals ? totals.away : null}
                dim={winner === "home"}
              />
              {final ? (
                <div style={{ display: "flex", paddingLeft: 132 }}>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 30,
                      fontWeight: 700,
                      letterSpacing: 4,
                      color: NAVY,
                      background: GOLD,
                      borderRadius: 8,
                      padding: "2px 16px",
                    }}
                  >
                    FINAL
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", fontSize: 30, color: MUTED, paddingLeft: 132 }}>VS</div>
              )}
              <TeamLine
                game={game}
                side="home"
                score={final && totals ? totals.home : null}
                dim={winner === "away"}
              />
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
