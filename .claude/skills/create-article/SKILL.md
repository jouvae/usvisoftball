---
name: create-article
description: Write a news article for usvisoftball.org from copy, notes or photos and push it to Supabase so it shows on the site. Hands the writing to the article-writer agent; saves to the editor review queue unless --publish is given.
argument-hint: "<copy or notes> [image paths] [--publish] [--update <slug>]"
disable-model-invocation: true
---

# /create-article

You are the **front desk**. Gather the inputs, hand the writing to the `article-writer`
agent, get the human's OK, and report. You do not write the article yourself, and you never
write to the database yourself.

Input: $ARGUMENTS

## 1. Read the request

Pull out of the input (and any pasted text / attached images in the conversation):

- **Copy or notes.** If the user supplied finished copy, it is used **word for word**.
- **Images.** Paths to photos or graphics. A cover is required.
- **Flags.** `--publish` → goes live on the site. Otherwise the article is saved as
  `in_review` (editor queue at `/admin/review`, not public). `--update <slug>` → revise
  an existing AI-written article instead of creating one.

**Hard stop:** if any image is `softball-schedule.*` (the U18 travel sheet with minors'
itineraries), refuse to use it and say why. It is never published or stored.

## 2. Ask only for what is missing

Use AskUserQuestion, one round, only for things you cannot settle from the input:

- no cover image → ask which image to use (list candidates in `.local/` if any);
- a preview or recap but no clear game → ask which game (offer upcoming / recent
  `calendar_events` slugs if you can name them);
- facts the copy needs but doesn't give (a score, a date) → ask; never guess.

Category, headline, excerpt, alt text and slug are the agent's job, not questions.

## 3. Set up the work folder

Create `.local/articles/<YYYY-MM-DD>-<short-slug>/` (gitignored; the publish script only
accepts local images from `.local/` or this folder). Write `brief.md` there containing:

- the user's copy **verbatim** in a fenced block (or their notes, labelled as notes);
- the image paths and what each one is, per the user;
- the game (calendar event slug) if known;
- the mode: `create` or `update <slug>`, and `publish` or `review`;
- any answers from step 2.

## 4. Prepare (dry run)

Spawn the `article-writer` agent with a short prompt pointing at the folder:

> Prepare an article from `<folder>/brief.md`. Mode: <create|update slug>, <review|publish>.
> Write `<folder>/spec.json`, run the publish script with `--dry-run`, and report back.

## 5. Confirm with the human

Show the dry-run result compactly: headline, excerpt, category, slug, status
(`in_review` or **live**), publish time in UTC **and** Virgin Islands time, linked game,
and the cover preview (Read `<folder>/preview-cover.jpg` so the user sees the crop).
Pass on any warnings the agent raised.

- With `--publish` the user already asked for it to go live → skip to step 6.
- Otherwise ask one question: save it (to the review queue), change something, or cancel.
  For changes, send them to the same agent (SendMessage) and repeat step 5.

## 6. Write

Tell the same agent (SendMessage, so it keeps its context) to run the script for real
with the same flags. If SendMessage isn't available, run the command it reported yourself.

## 7. Report

One short block: what was done (created / updated, in review / live), the link (the
article URL when live, `/admin/review` otherwise), and any warnings from the script
verbatim. If the script failed, say so with its error; do not retry with different flags
on your own (`--update`, `--publish` are the human's call).
