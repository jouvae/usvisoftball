# Changelog: softball/scoreboard

## 2026-11-24 — Phase 1
- New `Scoreboard` + `ScoreboardDetails` (`components/ui/scoreboard.tsx`) on articles linked
  to a game.
- Migration `0030_scoreboard.sql`: total-only runs, team walks and strikeouts on `games`, and
  a new `game_standouts` table.
- `gameRunTotals` replaces `runTotals(game.innings)` at every call site, so total-only
  results show in the feed score bar, highlights rail, Events rows/detail, OG image and SEO
  data.
- en/es strings under `scoreboard`. `publish-article.ts`: published_at read-back now compares
  instants, not strings.
