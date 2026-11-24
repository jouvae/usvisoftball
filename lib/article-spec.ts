// The article spec: the JSON contract between the `article-writer` agent and
// `scripts/publish-article.ts`. Pure — no I/O — so every rule here is unit-tested
// (tests/unit/article-spec.test.ts). The script owns the I/O (upload, upsert, verify).
//
// Rules live HERE, not in the agent prompt, so they hold no matter who writes the spec.

import { basename, resolve, sep } from "node:path";
import { slugify } from "./format";

// The categories already published on the site. Free text in the DB; fenced here so the
// feed doesn't grow near-duplicates ("Game recap", "Recap", …).
export const ARTICLE_CATEGORIES = [
  "Game Preview",
  "Game Recap",
  "Team News",
  "Federation News",
  "National Team",
  "Player Spotlight",
  "Youth",
  "Feature",
] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export const DEFAULT_AUTHOR = "Federation Staff";

// Images that must NEVER be published or stored: the U18 travel sheet carries minors'
// itineraries. Matched on the basename, case-insensitive, any extension.
const BLOCKED_IMAGE_PATTERNS = [/^softball-schedule(\.|-|_|$)/i];

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

export type ImageInput = { file?: string; url?: string; alt: string };
export type CoverFocus = "center" | "top" | "bottom" | "attention";

export type ArticleSpec = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category: ArticleCategory;
  authorName: string;
  cover: ImageInput & { focus: CoverFocus };
  gallery: ImageInput[];
  eventSlug: string | null;
  publishedAt: string | null; // ISO UTC; only used with --publish
  provenance: { model: string; source: string };
};

export type ParseResult = { ok: true; spec: ArticleSpec } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

export function isBlockedImage(path: string): boolean {
  const name = basename(path);
  return BLOCKED_IMAGE_PATTERNS.some((re) => re.test(name));
}

// A local image must live under one of the allowed roots (the repo's .local/ drop folder,
// or the run's working folder). Stops the agent from uploading arbitrary files from disk.
export function isAllowedImagePath(path: string, allowedRoots: string[]): boolean {
  const abs = resolve(path);
  return allowedRoots.some((root) => {
    const r = resolve(root);
    return abs === r || abs.startsWith(r.endsWith(sep) ? r : r + sep);
  });
}

// Body: plain paragraphs separated by a blank line (components/ui/article-body.tsx splits
// on /\n\n+/). Normalise line endings and trim each paragraph; no markdown.
export function normalizeBody(body: string): string {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}

// Emoji and other pictographs: allowed in the body, never in a headline.
const PICTOGRAPH = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;

function parseImage(
  v: unknown,
  where: string,
  allowedRoots: string[],
  errors: string[],
): ImageInput | null {
  if (!isObj(v)) {
    errors.push(`${where}: must be an object with file or url, and alt`);
    return null;
  }
  const file = str(v.file);
  const url = str(v.url);
  const alt = str(v.alt);
  if (!file === !url) errors.push(`${where}: give exactly one of file or url`);
  if (!alt) errors.push(`${where}.alt: required (describe what is in the picture)`);
  if (file) {
    if (isBlockedImage(file)) errors.push(`${where}.file: ${basename(file)} is blocked and must never be published`);
    if (!IMAGE_EXT.test(file)) errors.push(`${where}.file: must be .jpg, .jpeg, .png or .webp`);
    if (!isAllowedImagePath(file, allowedRoots))
      errors.push(`${where}.file: must be under one of ${allowedRoots.join(", ")}`);
  }
  if (url) {
    if (!/^https:\/\//.test(url)) errors.push(`${where}.url: must be https`);
    if (isBlockedImage(url.split("?")[0])) errors.push(`${where}.url: blocked image`);
  }
  return { file, url, alt: alt ?? "" };
}

export function parseArticleSpec(raw: unknown, opts: { allowedRoots: string[] }): ParseResult {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ["spec: must be a JSON object"] };

  const title = str(raw.title);
  if (!title) errors.push("title: required");
  else {
    if (PICTOGRAPH.test(title)) errors.push("title: no emoji in headlines (keep them in the body)");
    if (title.length > 120) errors.push("title: 120 characters max");
  }

  const slug = str(raw.slug) ?? (title ? slugify(title) : undefined);
  if (!slug) errors.push("slug: could not derive one from the title");
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    errors.push("slug: lowercase letters, digits and single hyphens only");
  else if (slug.length > 100) errors.push("slug: 100 characters max");

  const excerpt = str(raw.excerpt);
  if (!excerpt) errors.push("excerpt: required");
  else if (excerpt.length > 300) errors.push("excerpt: 300 characters max");

  const bodyRaw = str(raw.body);
  const body = bodyRaw ? normalizeBody(bodyRaw) : "";
  if (!body) errors.push("body: required");

  const category = str(raw.category);
  if (!category || !(ARTICLE_CATEGORIES as readonly string[]).includes(category))
    errors.push(`category: one of ${ARTICLE_CATEGORIES.join(", ")}`);

  const authorName = str(raw.author_name) ?? DEFAULT_AUTHOR;

  const coverIn = parseImage(raw.cover, "cover", opts.allowedRoots, errors);
  const focusRaw = isObj(raw.cover) ? (str(raw.cover.focus) ?? "attention") : "attention";
  if (!["center", "top", "bottom", "attention"].includes(focusRaw))
    errors.push("cover.focus: one of center, top, bottom, attention");

  const gallery: ImageInput[] = [];
  if (raw.gallery !== undefined) {
    if (!Array.isArray(raw.gallery)) errors.push("gallery: must be an array");
    else
      raw.gallery.forEach((g, i) => {
        const img = parseImage(g, `gallery[${i}]`, opts.allowedRoots, errors);
        if (img) gallery.push(img);
      });
  }

  const eventSlug = str(raw.event_slug) ?? null;

  let publishedAt: string | null = null;
  if (raw.published_at !== undefined && raw.published_at !== null) {
    const p = str(raw.published_at);
    if (!p || !/(Z|[+-]\d{2}:\d{2})$/.test(p) || Number.isNaN(Date.parse(p)))
      errors.push("published_at: ISO 8601 with a time zone (e.g. 2026-11-23T17:59:00Z)");
    else publishedAt = new Date(p).toISOString();
  }

  const prov = isObj(raw.provenance) ? raw.provenance : {};
  const model = str(prov.model);
  const source = str(prov.source);
  if (!model || !source)
    errors.push("provenance: { model, source } required — AI-written articles must say so");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    spec: {
      title: title!,
      slug: slug!,
      excerpt: excerpt!,
      body,
      category: category as ArticleCategory,
      authorName,
      cover: { ...coverIn!, focus: focusRaw as CoverFocus },
      gallery,
      eventSlug,
      publishedAt,
      provenance: { model: model!, source: source! },
    },
  };
}
