import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types (slice-02 §2.1). DB columns are snake_case; this module maps rows to
// camelCase so components consume clean props. Timestamps cross the boundary as
// ISO strings, never `Date` (serialization + determinism).
// ---------------------------------------------------------------------------

export type ArticleStatus = "draft" | "in_review" | "published" | "unpublished";
export type ArticleSource = "human" | "ai";

// One gallery item (slice-03 §2.2). Stored as a `jsonb` array element on the
// `articles.gallery` column; `url` is a root-relative `/public` path.
export interface GalleryImage {
  url: string;
  alt: string;
}

// AI provenance (slice-09 §4). The `articles.ai_provenance` jsonb shape — small +
// fixed for the prototype (source + model). `null` for every human/pre-AI row. If the
// real AiDraftJob later carries multiple sources, widen `source` to `sources: string[]`
// (debt §8). Always written as a real OBJECT, never JSON `null` (NIT-1).
export interface AiProvenance {
  source: string;
  model: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  authorName: string;
  category: string;
  status: ArticleStatus;
  source: ArticleSource;
  publishedAt: string | null; // ISO 8601 (UTC)
  createdAt: string; // ISO 8601 (UTC)
  updatedAt: string; // ISO 8601 (UTC)
  gallery: GalleryImage[]; // never null; DB default '[]'
  aiProvenance: AiProvenance | null; // { source, model } when source=ai; null otherwise
}

// Exactly the fields the feed card renders — keeps the payload minimal and makes
// it obvious the feed never ships `body`.
export type ArticleListItem = Pick<
  Article,
  | "id"
  | "title"
  | "slug"
  | "excerpt"
  | "coverImageUrl"
  | "coverImageAlt"
  | "authorName"
  | "category"
  | "publishedAt"
>;

// The ONE write shape. The admin editor (slices 05-07) and the seed both build this.
export interface CreateArticleInput {
  title: string;
  slug: string;
  body: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  authorName: string;
  authorId?: string | null; // FK → auth.users; the contributor path sets this
  category: string;
  status?: ArticleStatus; // defaults to "draft" at the DB
  source?: ArticleSource; // defaults to "human" at the DB
  publishedAt?: string | null; // ISO; set when status === "published"
  gallery?: GalleryImage[]; // defaults to [] at the DB when omitted
  aiProvenance?: AiProvenance | null; // → ai_provenance; omitted defaults to null at the DB
}

// ---------------------------------------------------------------------------
// Row shapes + mappers (snake_case DB ⇒ camelCase props).
// ---------------------------------------------------------------------------

interface ArticleListRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  author_name: string;
  category: string;
  published_at: string | null;
}

interface ArticleRow extends ArticleListRow {
  body: string;
  status: ArticleStatus;
  source: ArticleSource;
  created_at: string;
  updated_at: string;
  gallery: GalleryImage[] | null;
  ai_provenance: AiProvenance | null;
}

const LIST_COLUMNS =
  "id, title, slug, excerpt, cover_image_url, cover_image_alt, author_name, category, published_at";

// The FULL column set for the by-slug detail read (slice-03 §2.1). Explicit —
// so it is obvious `gallery` is included — mirroring LIST_COLUMNS' discipline.
const ARTICLE_COLUMNS =
  "id, title, slug, excerpt, cover_image_url, cover_image_alt, author_name, category, published_at, body, status, source, created_at, updated_at, gallery, ai_provenance";

function toListItem(row: ArticleListRow): ArticleListItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    coverImageUrl: row.cover_image_url,
    coverImageAlt: row.cover_image_alt,
    authorName: row.author_name,
    category: row.category,
    publishedAt: row.published_at,
  };
}

function toArticle(row: ArticleRow): Article {
  return {
    ...toListItem(row),
    body: row.body,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // The NOT-NULL column guarantees an array; `?? []` is belt-and-suspenders.
    gallery: row.gallery ?? [],
    // Nullable jsonb — null for every human/pre-AI row (slice-09 §4).
    aiProvenance: row.ai_provenance ?? null,
  };
}

// ---------------------------------------------------------------------------
// Public read path (slice-02 §2.2). Uses the RLS-ENFORCED publishable client on
// purpose: the feed genuinely exercises RLS. `.eq('status','published')` is a
// convenience — RLS is the actual boundary (§1.3). Newest-first by published_at.
// Returns [] when nothing is published (NOT an error).
// ---------------------------------------------------------------------------
export async function listPublishedArticles(): Promise<ArticleListItem[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("articles")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => toListItem(row as ArticleListRow));
}

// ---------------------------------------------------------------------------
// Public by-slug read path (slice-03 §2.1). Reads through the RLS-ENFORCED
// publishable client — the SAME boundary as listPublishedArticles — so a broken
// policy fails the tests rather than being masked. DELIBERATELY has NO
// `.eq("status","published")` filter: RLS alone is the visibility control, which
// makes the 404 for a draft a genuine RLS assertion (§2.1).
//
// `.maybeSingle()` returns `{ data: null, error: null }` for zero visible rows.
// Returns `null` ONLY when data is null AND error is null; any real DB/transport
// error THROWS — a 404 must never hide an outage (§8-#1).
// ---------------------------------------------------------------------------
export async function getPublishedArticleBySlug(
  slug: string,
): Promise<Article | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (data == null) return null;
  return toArticle(data as unknown as ArticleRow);
}

// ---------------------------------------------------------------------------
// The ONE canonical write path (slice-02 §2.2, slice-05 §2.1). Nothing anywhere
// hand-writes an article row. Pure insert — no upsert. The CLIENT is INJECTABLE:
// it defaults to the RLS-bypassing admin client (the seed path, unchanged), but
// the contributor Server Action passes the cookie SESSION client so the SAME typed
// insert runs RLS-enforced as the contributor. The RETURNING re-read
// (.select().single()) passes the contributor own-read policy (author_id = self).
// On a duplicate `slug` the thrown PostgrestError carries `.code === "23505"`.
// ---------------------------------------------------------------------------
export async function createArticle(
  input: CreateArticleInput,
  supabase: SupabaseClient = createAdminClient(),
): Promise<Article> {
  const { data, error } = await supabase
    .from("articles")
    .insert({
      title: input.title,
      slug: input.slug,
      body: input.body,
      excerpt: input.excerpt,
      cover_image_url: input.coverImageUrl,
      cover_image_alt: input.coverImageAlt,
      author_name: input.authorName,
      author_id: input.authorId,
      category: input.category,
      status: input.status,
      source: input.source,
      published_at: input.publishedAt,
      gallery: input.gallery ?? [],
      // NIT-1: send SQL NULL for human rows (short-circuited by the table CHECK) and a
      // real OBJECT for AI rows — never JSON `null`, which passes IS NOT NULL yet carries
      // no provenance. The AI write path always supplies { source, model }.
      ai_provenance: input.aiProvenance ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return toArticle(data as ArticleRow);
}

// ---------------------------------------------------------------------------
// Contributor read paths (slice-05 §3). BOTH take an INJECTED client so the
// caller passes the RLS-ENFORCED session client — the contributor own-read policy
// (author_id = auth.uid()) is what scopes these to the caller's own rows.
// ---------------------------------------------------------------------------

// The `[id]` editor read: one own row by id. `.maybeSingle()` returns
// `{ data: null }` for a row the caller cannot see (RLS) or a missing id — the
// page turns that into a 404. A real DB/transport error THROWS.
export async function getArticleById(
  id: string,
  supabase: SupabaseClient,
): Promise<Article | null> {
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (data == null) return null;
  return toArticle(data as unknown as ArticleRow);
}

// The editorial queue read: the caller's own draft + in_review rows, newest edit
// first. The status filter excludes published (which the authenticated caller
// could otherwise see via the 0001 published-read policy); RLS own-read scopes the
// rest to the caller. Returns [] when the caller has none (NOT an error).
export async function listQueueArticles(
  supabase: SupabaseClient,
): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .in("status", ["draft", "in_review"])
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => toArticle(row as unknown as ArticleRow));
}

// The ONE submit mutator (slice-05 §2.1). Injected client => RLS-enforced: the
// contributor UPDATE policy permits draft→in_review on an own row and its WITH
// CHECK forbids any other target status. The `.eq('status','draft')` guard is a
// convenience; RLS is the boundary. `.single()` throws PostgrestError code
// 'PGRST116' when 0 rows match (a foreign id, or the row is not a draft) — the
// caller (submitForReview action) MUST catch that and return { error }.
export async function submitArticleForReview(
  id: string,
  supabase: SupabaseClient,
): Promise<Article> {
  const { data, error } = await supabase
    .from("articles")
    .update({ status: "in_review" })
    .eq("id", id)
    .eq("status", "draft")
    .select("*")
    .single();

  if (error) throw error; // PGRST116 on 0 rows — caught in the Server Action
  return toArticle(data as ArticleRow);
}

// Field-save for the editor's "Save" (own draft/in_review only, RLS-enforced).
// `.single()` throws PGRST116 on 0 rows (foreign/non-editable id) — the caller
// catches it and returns { error }.
export async function saveDraftFields(
  id: string,
  fields: Pick<
    CreateArticleInput,
    "title" | "body" | "category" | "coverImageUrl" | "coverImageAlt"
  >,
  supabase: SupabaseClient,
): Promise<Article> {
  const { data, error } = await supabase
    .from("articles")
    .update({
      title: fields.title,
      body: fields.body,
      category: fields.category,
      cover_image_url: fields.coverImageUrl,
      cover_image_alt: fields.coverImageAlt,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return toArticle(data as ArticleRow);
}

// ---------------------------------------------------------------------------
// Editor write/read paths (slice-06 §2). All take an INJECTED client so the
// caller passes the RLS-ENFORCED session client — the editor policies
// (articles_editor_read_all / articles_editor_update, both gated by
// has_role(auth.uid(),'editor')) are what scope these to a real editor. NEVER the
// admin client on the assertion path (it bypasses RLS and would defeat the point).
// ---------------------------------------------------------------------------

// The ONE publish mutator. Sets status='published' + published_at=now() and, when
// supplied, the edited body — in a SINGLE update, matching the scenario's "edit the
// body and publish it" gesture. No `.eq('status', …)` guard: RLS is the boundary and
// an editor may publish any editor-visible row. `.single()` throws PostgrestError
// 'PGRST116' on 0 rows (RLS denied — caller is not really an editor — or a missing
// id); the publishArticle Server Action MUST catch that and return { error }.
// R2: published_at is stamped ONLY on a first publish (when the row has none yet).
// A re-publish (e.g. unpublish→re-publish, which leaves the original published_at
// intact) PRESERVES the original timestamp, so the feed does not reorder by rewriting
// the date. The pre-read is RLS-enforced through the same session client; if the row
// is not editor-visible the read returns null and the subsequent update matches 0 rows
// → PGRST116 (the caller's error signal), so the pre-read never masks an authz denial.
export async function publishArticle(
  id: string,
  fields: { body?: string },
  supabase: SupabaseClient,
): Promise<Article> {
  const { data: existing } = await supabase
    .from("articles")
    .select("published_at")
    .eq("id", id)
    .maybeSingle();

  const patch: Record<string, unknown> = { status: "published" };
  if (fields.body !== undefined) patch.body = fields.body;
  // Only stamp when there is no prior published_at — preserve the original otherwise.
  if (!(existing as { published_at?: string | null } | null)?.published_at) {
    patch.published_at = new Date().toISOString(); // ISO 8601 UTC — the 0001 CHECK requires non-null
  }

  const { data, error } = await supabase
    .from("articles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error; // PGRST116 on 0 rows — caught in the Server Action
  return toArticle(data as ArticleRow);
}

// The editor edit-body Save without publishing (own-or-any row, RLS-enforced by
// articles_editor_update). Distinct from the contributor `saveDraftFields`, whose
// RLS requires author_id=self. Scoped to `body` this slice; the UI wire-up is
// optional (§2.2) — the review view ships Publish only. PGRST116 handled by caller.
export async function saveArticleAsEditor(
  id: string,
  fields: { body: string },
  supabase: SupabaseClient,
): Promise<Article> {
  const { data, error } = await supabase
    .from("articles")
    .update({ body: fields.body })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error; // PGRST116 on 0 rows — caught in the Server Action
  return toArticle(data as ArticleRow);
}

// The editor-wide EDITORIAL queue read (slice-08 §5): ALL in_review + published +
// unpublished rows through the SESSION client, visible only because
// articles_editor_read_all makes every row visible to an editor (a contributor
// calling this would see only their OWN matching rows, which is why the queue page
// BRANCHES on role). `draft` is EXCLUDED — a draft is still being authored by a
// contributor and is not an editorial-decision item. Newest edit first. Returns []
// when the queue is empty (NOT an error).
export async function listEditorialQueue(
  supabase: SupabaseClient,
): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .in("status", ["in_review", "published", "unpublished"])
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => toArticle(row as unknown as ArticleRow));
}

// The ONE unpublish mutator (slice-08 §2). Injected client => RLS-enforced by
// articles_editor_update (has_role editor). Patches ONLY status='unpublished'; it
// does NOT touch published_at (the 0001 CHECK constrains only the published state,
// so keeping the timestamp preserves the original-publish record), nor source /
// author_id. No `.eq('status', …)` guard: RLS is the boundary and an editor may
// transition any editor-visible row. `.single()` throws PostgrestError 'PGRST116'
// on 0 rows (RLS denied — caller is not really an editor — or a missing id); the
// unpublishArticle Server Action MUST catch that and return { error }.
export async function unpublishArticle(
  id: string,
  supabase: SupabaseClient,
): Promise<Article> {
  const { data, error } = await supabase
    .from("articles")
    .update({ status: "unpublished" })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error; // PGRST116 on 0 rows — caught in the Server Action
  return toArticle(data as ArticleRow);
}

// ---------------------------------------------------------------------------
// Test-only reset helper (slice-02 §9.2). Truncates every article via the
// BYPASSRLS admin client — NOT raw SQL, NOT the public client (which has no delete
// policy). Used solely by the spec's serial, desktop-only empty-state test.
// ---------------------------------------------------------------------------
export async function deleteAllArticles(): Promise<void> {
  const supabase = createAdminClient();
  // PostgREST requires a filter on DELETE; match every row (id is always present).
  const { error } = await supabase
    .from("articles")
    .delete()
    .not("id", "is", null);

  if (error) throw error;
}
