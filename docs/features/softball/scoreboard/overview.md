# softball/scoreboard

**Problem.** Recaps carried their numbers as pasted text ("By the Numbers", standout tables), so
the game itself stayed "pregame": no score on the article, feed, highlights rail or Events page,
and the stats read as a wall of loose lines.

**Solution.** A `Scoreboard` rendered from the **game** the article is linked to
(`articles.game_id`), so every surface shows the same result.

- `components/ui/scoreboard.tsx`
  - `Scoreboard`: the score header, placed between the byline and the cover. Status chip
    (Final / Live / Upcoming / Score pending), round · venue · date, teams with flags, and the
    score with the winner marked. Teams stack on phones and sit side by side on wider screens.
    Upcoming games show first pitch in Virgin Islands time plus local time. Links to the game
    page when Events is on. The visuals are `aria-hidden`; one sr-only sentence gives the
    result.
  - `ScoreboardDetails`, placed after the body:
    - "By the numbers": a mirrored-bar team comparison inside a real `<table>`.
    - The existing `LineScore`, only when innings exist.
    - Standouts: Player of the Game and the pitching standout as cards, then a compact list.

## Decisions
- **D1 — data lives on the game, not the article.** Enter once, shown everywhere, so two
  recaps can't disagree.
- **D2 — total-only results.** `games.away_runs` / `home_runs` hold a result that arrives as
  "8–5". Innings win when present (`gameRunTotals`), and every former `runTotals(game.innings)`
  call site uses it.
- **D3 — no "0" for unknown.** Walks and strikeouts are nullable and hidden when null. Errors
  default to 0 in the database, so the errors row shows only when either side has one.
- **D4 — standouts are editor picks** (`game_standouts`), not computed. At most one Player of
  the Game and one pitching standout per game (partial unique index). Player names are text
  until the U18 roster is in `team_players`.
- **D5 — the body is prose.** Stats shown by the scoreboard don't repeat in the body.

## Data — `0030_scoreboard.sql` (additive, applied to prod 2026-11-24)
- `games` gains six nullable columns: `away_runs`, `home_runs`, `away_walks`, `home_walks`,
  `away_strikeouts`, `home_strikeouts`. Walks are drawn by that side's batters; strikeouts are
  by that side's pitchers.
- New table `game_standouts`:
  - columns: `kind` (`player_of_game` | `pitching` | `standout`), `player_name`, `stat_line`,
    `note`, `team_id`, `sort_order`;
  - RLS: public read; editor or scorekeeper insert/update; editor-only delete.

## Phases
1. **Done:** data, component, article page, Mexico backfill, recap body trimmed.
2. Upcoming-game version on previews (built in; verify on a real preview) and the Events page
   using the same components.
3. `/create-article` writes the result, team stats and standouts from the copy (shown in the
   dry run); `/admin/scoring` gains the total-only score, team stats and standouts.
