# Scenarios: softball/scoreboard

- **scoreboard-web-001** — Given a published recap linked to a final game, the scoreboard sits
  above the cover with status Final, both scores, and a one-sentence result for screen readers.
- **scoreboard-web-002** — By the numbers shows only recorded stats (runs, hits, and walks and
  strikeouts when set; errors only when non-zero), as a table; no line score without innings.
- **scoreboard-web-003** — Standouts list Player of the Game first, then the pitching standout,
  then the rest in order.
- **scoreboard-web-004** — The page in Spanish (`/es`) localizes names and labels; no sideways
  scroll at 390px.
- **scoreboard-unit-001** — Runs come from innings when present, else the stored result,
  else 0–0; the winner of a total-only final is correct.
