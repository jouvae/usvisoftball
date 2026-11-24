# Article style guide — usvisoftball.org

Read by the `article-writer` agent before every article. The publish script enforces the
mechanical rules (marked **enforced**); the rest is judgement.

## Truth first
- **Supplied copy is used word for word.** Don't polish, trim or "improve" it. You may only
  split it into paragraphs where it already breaks.
- **Never invent** facts, quotes, scores, stats, names, ages, schools or outcomes. Notes
  only → write only what the notes support. Missing a fact → leave it out and report it.
- Check names against the database (roster / board) when the copy is unclear; spell them
  as the Federation does.
- Reuse claims the site already makes rather than inventing mission copy.

## Headline (`title`)
- Plain, specific, active: who did what. ≤ 120 chars (**enforced**).
- **No emoji** in headlines (**enforced**); they are fine in the body.
- Title case, matching the existing articles.

## Excerpt
- One or two sentences, ≤ 300 chars (**enforced**). Shown on cards and in the feed. The key
  fact a fan wants: result, matchup, time.

## Body
- Plain paragraphs separated by a blank line. No markdown, no headings, no bullet lists
  (the site renders paragraphs only).
- Dateline style for event coverage: `SAN SALVADOR, El Salvador, Nov. 23 — …`.
- Close with where fans can follow: "The latest times, scores and results are on the Events
  page at usvisoftball.org." when relevant.

## Times and dates
- Store `published_at` in UTC with a zone (**enforced**). Omit it to use "now".
- In the body, give game times in **local time and Virgin Islands time** (AST, UTC−4).
  El Salvador is UTC−6: VI = El Salvador + 2 hours. Write "noon in El Salvador and 2 p.m.
  in the Virgin Islands".
- Use the game's `starts_at` from `calendar_events` as the source of truth; if the copy
  disagrees, keep the copy and report the mismatch.

## Category (**enforced** list)
Game Preview · Game Recap · Team News · Federation News · National Team ·
Player Spotlight · Youth · Feature

## Game link
- Previews and recaps link their game: set `event_slug` (a `calendar_events.slug`, e.g.
  `us-virgin-islands-vs-mexico-2026-11-23`). The site then shows the score line.

## Stats belong in the scoreboard, not the body
- A recap linked to a game renders its result, team stats and standouts in the Scoreboard
  (`components/ui/scoreboard.tsx`). Don't paste stat tables, "By the Numbers" blocks or
  standout lists into the body; keep the prose.
- Until `/create-article` can write game data (scoreboard phase 3), report those stats in your
  warnings so they can be loaded onto the game.

## Images
- **Never** `softball-schedule.*` (minors' travel itineraries) — **enforced**, any path.
- Cover: the script crops to 1600×900. Set `cover.focus` (`attention` default; `top` for
  group photos where heads would be cut; `center` for graphics).
- Federation graphics with text: prefer `center` and check the preview — text cut off at
  the edges means pick another focus or another image.
- Alt text describes what is in the picture (people, jerseys, setting, any text in a
  graphic), not what the article is about. Required (**enforced**).
- Additional photos go in `gallery`, each with alt text.

## Byline and provenance
- `author_name` defaults to "Federation Staff".
- `provenance` is required (**enforced**): `model` (your model id) and `source` naming
  what you worked from, e.g. `"federation copy (verbatim) + usvisoftball-8.jpeg"`.
