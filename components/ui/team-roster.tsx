import type { TeamPlayer } from "@/lib/teams";

// The roster table on a team detail page (teams-web-002). Server Component — no
// interactivity. Columns: No. / Name / Position / Bats-Throws, ordered by the caller. All
// values React-escaped. Empty roster → a friendly note (real empty-state branch).
export function TeamRoster({
  players,
  testId = "team-roster",
}: {
  players: TeamPlayer[];
  testId?: string;
}) {
  if (players.length === 0) {
    return (
      <p data-testid="team-roster-empty" className="text-muted">
        Roster coming soon.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        data-testid={testId}
        className="w-full min-w-[28rem] border-collapse text-left text-sm"
      >
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-4 font-semibold">No.</th>
            <th className="py-2 pr-4 font-semibold">Name</th>
            <th className="py-2 pr-4 font-semibold">Pos</th>
            <th className="py-2 font-semibold">B/T</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr
              key={p.id}
              data-testid="team-roster-row"
              className="border-b border-border/60"
            >
              <td
                data-testid="player-number"
                className="py-2 pr-4 font-display font-semibold text-brand"
              >
                {p.jerseyNumber ?? "—"}
              </td>
              <td
                data-testid="player-name"
                className="py-2 pr-4 font-medium text-foreground"
              >
                {p.name}
              </td>
              <td data-testid="player-position" className="py-2 pr-4 text-muted">
                {p.position || "—"}
              </td>
              <td data-testid="player-bt" className="py-2 text-muted">
                {p.batsThrows || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
