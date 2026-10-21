import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import {
  type HomeStat,
  type StatIcon,
  STAT_ICON_LABELS,
  STAT_LIMITS,
  formatAsOf,
  isStatIcon,
  safeSourceHref,
} from "@/lib/stats-view";

// ---------------------------------------------------------------------------
// Feature softball/home-layout — the editor-managed home stats strip (design guide §2.2,
// §4.1; migration 0023).
//
// SERVER ONLY. The public read goes through the RLS-enforced publishable client, where the
// 0023 policy only exposes published rows. The admin read and every write take an
// INJECTABLE session client with NO default — /admin/stats always passes the editor cookie
// client, so the 0023 editor RLS is the real boundary (a non-editor matches 0 rows →
// PGRST116 on update). Client-safe types/constants live in lib/stats-view.ts.
// ---------------------------------------------------------------------------

export {
  type HomeStat,
  type StatIcon,
  STAT_ICON_LABELS,
  STAT_LIMITS,
  formatAsOf,
  isStatIcon,
  safeSourceHref,
};

type StatRow = {
  id: string;
  label: string;
  value: string;
  detail: string;
  icon: string;
  as_of: string;
  source_url: string | null;
  sort_order: number;
  is_published: boolean;
};

const COLUMNS =
  "id,label,value,detail,icon,as_of,source_url,sort_order,is_published";

function toStat(row: StatRow): HomeStat {
  return {
    id: row.id,
    label: row.label,
    value: row.value,
    detail: row.detail,
    // The 0023 CHECK guarantees a known icon; fall back defensively rather than throw.
    icon: isStatIcon(row.icon) ? row.icon : "trophy",
    asOf: row.as_of,
    sourceUrl: row.source_url,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  };
}

// The home strip: published stats by sort_order (then label), capped at `limit` — the strip
// shows at most three. Returns [] when nothing is published (the home then omits the strip).
export async function listPublishedStats(limit = 3): Promise<HomeStat[]> {
  const { data, error } = await createPublicClient()
    .from("home_stats")
    .select(COLUMNS)
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data as StatRow[] | null) ?? []).map(toStat);
}

// The admin list: EVERY stat (drafts included — the 0023 editor-read policy), same order.
export async function listAllStats(supabase: SupabaseClient): Promise<HomeStat[]> {
  const { data, error } = await supabase
    .from("home_stats")
    .select(COLUMNS)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true })
    .limit(100);
  if (error) throw error;
  return ((data as StatRow[] | null) ?? []).map(toStat);
}

export interface StatInput {
  label: string;
  value: string;
  detail: string;
  icon: StatIcon;
  asOf: string;
  sourceUrl: string | null;
  sortOrder: number;
  isPublished: boolean;
}

export class StatSourceUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatSourceUrlError";
  }
}

// Write-boundary check for the source link: absent, or a parseable https URL.
export function assertSourceUrlAllowed(url: string | null): void {
  if (!url) return;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new StatSourceUrlError("Source link must be a full https:// URL.");
  }
  if (u.protocol !== "https:") {
    throw new StatSourceUrlError("Source link must start with https://.");
  }
}

function toRow(input: StatInput) {
  return {
    label: input.label,
    value: input.value,
    detail: input.detail,
    icon: input.icon,
    as_of: input.asOf,
    source_url: input.sourceUrl,
    sort_order: input.sortOrder,
    is_published: input.isPublished,
  };
}

export async function createStat(
  input: StatInput,
  supabase: SupabaseClient,
): Promise<HomeStat> {
  assertSourceUrlAllowed(input.sourceUrl);
  const { data, error } = await supabase
    .from("home_stats")
    .insert(toRow(input))
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toStat(data as StatRow);
}

export async function updateStat(
  id: string,
  input: StatInput,
  supabase: SupabaseClient,
): Promise<HomeStat> {
  assertSourceUrlAllowed(input.sourceUrl);
  const { data, error } = await supabase
    .from("home_stats")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toStat(data as StatRow);
}

export async function deleteStat(id: string, supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.from("home_stats").delete().eq("id", id);
  if (error) throw error;
}
