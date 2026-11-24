// Publish one article from a JSON spec (lib/article-spec.ts) to Supabase — the ONLY write
// path the `article-writer` agent uses. Idempotent on slug, never deletes.
//
//   npm run article:publish -- <spec.json> [--dry-run] [--publish] [--update] [--base-url URL]
//
//   --dry-run   validate, resolve the game, crop the cover to <spec dir>/preview-cover.jpg,
//               print what WOULD be written. No upload, no DB write.
//   --publish   status 'published' (live on the site). Without it: 'in_review' (editor
//               queue at /admin/review, not public).
//   --update    allow overwriting an existing article with the same slug (AI-written only;
//               a human-written article is never overwritten).
//   --base-url  site to verify against (default SITE_URL).
//
// Local images must sit under <repo>/.local or the spec's own folder. Output: one JSON
// object on stdout. Exit 1 on any refusal.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";
import { parseArticleSpec, type ArticleSpec, type ImageInput } from "../lib/article-spec";
import { SITE_URL } from "../lib/site";
import { createAdminClient } from "../lib/supabase/admin";

const REPO = resolve(import.meta.dirname, "..");
const BUCKET = "board-photos";

type Flags = { dryRun: boolean; publish: boolean; update: boolean; baseUrl: string };

function fail(msg: string, extra: Record<string, unknown> = {}): never {
  console.log(JSON.stringify({ ok: false, error: msg, ...extra }, null, 2));
  process.exit(1);
}

function parseArgs(argv: string[]): { specPath: string; flags: Flags } {
  const flags: Flags = { dryRun: false, publish: false, update: false, baseUrl: SITE_URL };
  let specPath: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--publish") flags.publish = true;
    else if (a === "--update") flags.update = true;
    else if (a === "--base-url") flags.baseUrl = (argv[++i] ?? "").replace(/\/+$/, "");
    else if (a.startsWith("--")) fail(`unknown flag ${a}`);
    else specPath = a;
  }
  if (!specPath) fail("usage: publish-article <spec.json> [--dry-run] [--publish] [--update] [--base-url URL]");
  return { specPath: resolve(specPath), flags };
}

// Postgres returns "+00:00", JS writes "Z": compare instants, not strings.
const sameInstant = (a: string | null, b: string | null) =>
  a == null || b == null ? a === b : Date.parse(a) === Date.parse(b);

const hash8 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex").slice(0, 8);

async function processCover(spec: ArticleSpec): Promise<Buffer | null> {
  if (!spec.cover.file) return null;
  const position = spec.cover.focus === "attention" ? sharp.strategy.attention : spec.cover.focus;
  return sharp(spec.cover.file)
    .rotate()
    .resize(1600, 900, { fit: "cover", position })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

async function processGalleryImage(img: ImageInput): Promise<Buffer | null> {
  if (!img.file) return null;
  return sharp(img.file)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

async function main() {
  const { specPath, flags } = parseArgs(process.argv.slice(2));
  const workDir = dirname(specPath);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (e) {
    fail(`could not read spec: ${(e as Error).message}`);
  }
  const parsed = parseArticleSpec(raw, { allowedRoots: [join(REPO, ".local"), workDir] });
  if (!parsed.ok) fail("spec invalid", { errors: parsed.errors });
  const spec = parsed.spec;
  const status = flags.publish ? "published" : "in_review";

  const db = createAdminClient();

  // ── Existing article with this slug? ──
  const existingRes = await db
    .from("articles")
    .select("id, status, source, published_at")
    .eq("slug", spec.slug)
    .maybeSingle();
  if (existingRes.error) fail(`slug lookup failed: ${existingRes.error.message}`);
  const existing = existingRes.data as
    | { id: string; status: string; source: string; published_at: string | null }
    | null;
  if (existing) {
    if (existing.source !== "ai") fail(`slug "${spec.slug}" belongs to a human-written article; pick another slug`);
    if (!flags.update) fail(`slug "${spec.slug}" already exists (${existing.status}); pass --update to overwrite it`);
    if (existing.status === "published" && !flags.publish)
      fail(`"${spec.slug}" is live; pass --publish to update it in place (otherwise it would leave the site)`);
  }

  // ── Game link ──
  let gameId: string | null = null;
  let gameLabel: string | null = null;
  if (spec.eventSlug) {
    const ev = await db
      .from("calendar_events")
      .select("starts_at, games(id)")
      .eq("slug", spec.eventSlug)
      .maybeSingle();
    if (ev.error) fail(`event lookup failed: ${ev.error.message}`);
    if (!ev.data) fail(`no calendar event with slug "${spec.eventSlug}"`);
    const g = (ev.data as { games: { id: string } | { id: string }[] | null }).games;
    const game = Array.isArray(g) ? g[0] : g;
    if (!game) fail(`event "${spec.eventSlug}" has no game attached`);
    gameId = game.id;
    gameLabel = `${spec.eventSlug} (${(ev.data as { starts_at: string }).starts_at})`;
  }

  // ── Images ──
  let coverBuf: Buffer | null;
  let galleryBufs: (Buffer | null)[];
  try {
    coverBuf = await processCover(spec);
    galleryBufs = await Promise.all(spec.gallery.map(processGalleryImage));
  } catch (e) {
    fail(`image processing failed: ${(e as Error).message}`);
  }

  const publishedAt = flags.publish
    ? (spec.publishedAt ?? existing?.published_at ?? new Date().toISOString())
    : null;
  const pageUrl = `${flags.baseUrl}/articles/${spec.slug}`;

  if (flags.dryRun) {
    let preview: string | null = null;
    if (coverBuf) {
      preview = join(workDir, "preview-cover.jpg");
      writeFileSync(preview, coverBuf);
    }
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          action: existing ? "update" : "create",
          slug: spec.slug,
          title: spec.title,
          category: spec.category,
          author: spec.authorName,
          status,
          publishedAt,
          game: gameLabel,
          coverPreview: preview ?? spec.cover.url,
          gallery: spec.gallery.length,
          url: flags.publish ? pageUrl : `${flags.baseUrl}/admin/review`,
          words: spec.body.split(/\s+/).length,
        },
        null,
        2,
      ),
    );
    return;
  }

  // ── Upload (content-hashed paths: a changed image gets a new URL, no stale CDN copy) ──
  async function upload(buf: Buffer, kind: string): Promise<string> {
    const path = `articles/${spec.slug}/${kind}-${hash8(buf)}.jpg`;
    const up = await db.storage.from(BUCKET).upload(path, buf, { contentType: "image/jpeg", upsert: true });
    if (up.error) fail(`upload ${path} failed: ${up.error.message}`);
    return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  const coverUrl = coverBuf ? await upload(coverBuf, "cover") : spec.cover.url!;
  const gallery = [];
  for (let i = 0; i < spec.gallery.length; i++) {
    const buf = galleryBufs[i];
    gallery.push({ url: buf ? await upload(buf, `gallery-${i + 1}`) : spec.gallery[i].url!, alt: spec.gallery[i].alt });
  }

  // ── Write ──
  const row = {
    slug: spec.slug,
    title: spec.title,
    excerpt: spec.excerpt,
    body: spec.body,
    category: spec.category,
    author_name: spec.authorName,
    cover_image_url: coverUrl,
    cover_image_alt: spec.cover.alt,
    gallery,
    game_id: gameId,
    status,
    source: "ai",
    published_at: publishedAt,
    ai_provenance: { ...spec.provenance, via: "create-article" },
    updated_at: new Date().toISOString(),
  };
  const write = existing
    ? await db.from("articles").update(row).eq("id", existing.id).select("id").single()
    : await db.from("articles").insert(row).select("id").single();
  if (write.error) fail(`write failed: ${write.error.message}`, { code: write.error.code });

  // ── Verify: read back, then check the public page ──
  const back = await db
    .from("articles")
    .select("id, slug, title, status, published_at, game_id, cover_image_url")
    .eq("id", (write.data as { id: string }).id)
    .single();
  if (back.error) fail(`read-back failed: ${back.error.message}`);
  const b = back.data as typeof row & { id: string };
  const mismatches = (["title", "status", "published_at", "game_id", "cover_image_url"] as const).filter(
    (k) => (k === "published_at" ? sameInstant(b[k], row[k]) : b[k] === row[k]) === false,
  );

  const warnings: string[] = [];
  if (mismatches.length) warnings.push(`read-back differs on: ${mismatches.join(", ")}`);
  let pageStatus: number | null = null;
  try {
    const res = await fetch(pageUrl, { redirect: "follow", headers: { "cache-control": "no-cache" } });
    pageStatus = res.status;
    const expected = flags.publish ? 200 : 404;
    if (res.status !== expected)
      warnings.push(`${pageUrl} returned ${res.status}, expected ${expected}`);
  } catch (e) {
    warnings.push(`could not reach ${pageUrl}: ${(e as Error).message}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: mismatches.length === 0,
        action: existing ? "updated" : "created",
        id: b.id,
        slug: b.slug,
        title: b.title,
        status: b.status,
        publishedAt: b.published_at,
        game: gameLabel,
        cover: coverUrl,
        url: flags.publish ? pageUrl : `${flags.baseUrl}/admin/review`,
        pageStatus,
        warnings,
      },
      null,
      2,
    ),
  );
  if (mismatches.length) process.exit(1);
}

main().catch((err) => fail(`unexpected: ${(err as Error).message}`));
