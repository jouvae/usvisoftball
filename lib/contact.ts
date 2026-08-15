import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";

// ---------------------------------------------------------------------------
// Feature softball/about, Slice 4 — federation contact info (contact_info singleton).
//
// SERVER ONLY. Reads go through the RLS-enforced publishable client (public /about is a
// real read of the public SELECT policy). The update takes an INJECTABLE session client
// with NO admin default — /admin/contact always passes the editor cookie client, so the
// 0010 editor RLS is the real boundary. Social URLs are validated (https + host allowlist)
// BEFORE the DB write, defense-in-depth against javascript:/data:/open-redirect in the
// rendered <a href>. Client Components may import the TYPES below (type-only imports are
// erased, so they never drag `server-only` into the browser bundle).
// ---------------------------------------------------------------------------

export interface ContactInfo {
  email: string;
  phone: string;
  address: string;
  facebookUrl: string;
  instagramUrl: string;
  updatedAt: string; // ISO 8601 (UTC)
}

export interface UpdateContactInput {
  email: string;
  phone: string;
  address: string;
  facebookUrl: string;
  instagramUrl: string;
}

const FACEBOOK_HOSTS = ["facebook.com", "www.facebook.com", "m.facebook.com"];
const INSTAGRAM_HOSTS = ["instagram.com", "www.instagram.com"];

// Thrown when a social URL fails validation. A distinct type so the Server Action maps it
// to a friendly form error rather than a 500.
export class ContactUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactUrlError";
  }
}

// A social URL is optional (''); if present it MUST be an https URL on an allowlisted host.
// This blocks `javascript:`/`data:` schemes (stored XSS via href) and off-platform
// open-redirects — the field is rendered as a public <a href>.
export function assertSocialUrlAllowed(
  url: string,
  allowedHosts: readonly string[],
  label: string,
): void {
  if (!url) return; // optional
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new ContactUrlError(`${label} must be a full https:// URL.`);
  }
  if (u.protocol !== "https:") {
    throw new ContactUrlError(`${label} must start with https://.`);
  }
  if (!allowedHosts.includes(u.host)) {
    throw new ContactUrlError(
      `${label} must be a ${allowedHosts[0]} URL.`,
    );
  }
}

// Non-throwing twin of assertSocialUrlAllowed, for the RENDER path. '' (unset) counts as
// allowed (it renders nothing). Anything present must be https on an allowlisted host.
function isSocialUrlAllowed(url: string, allowedHosts: readonly string[]): boolean {
  if (!url) return true;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return u.protocol === "https:" && allowedHosts.includes(u.host);
}

// Render-time guard (defense-in-depth, red-team-interactive Low): return the URL to use as
// an <a href> ONLY if it still passes the https + host allowlist; otherwise ''. So even a
// value that reached the DB around the app write path (a misused editor token on PostgREST,
// or a future non-validating writer) is dropped at render, never emitted as a live link.
export function safeSocialHref(
  url: string,
  platform: "facebook" | "instagram",
): string {
  const hosts = platform === "facebook" ? FACEBOOK_HOSTS : INSTAGRAM_HOSTS;
  return isSocialUrlAllowed(url, hosts) ? url : "";
}

const COLUMNS = "email,phone,address,facebook_url,instagram_url,updated_at";

type ContactRow = {
  email: string;
  phone: string;
  address: string;
  facebook_url: string;
  instagram_url: string;
  updated_at: string;
};

function toContact(row: ContactRow): ContactInfo {
  return {
    email: row.email,
    phone: row.phone,
    address: row.address,
    facebookUrl: row.facebook_url,
    instagramUrl: row.instagram_url,
    updatedAt: row.updated_at,
  };
}

// Read the singleton contact row. Public read via the RLS publishable client; returns null
// only if the row is somehow absent (the migration seeds it, so /about degrades gracefully).
export async function getContactInfo(
  supabase: SupabaseClient = createPublicClient(),
): Promise<ContactInfo | null> {
  const { data, error } = await supabase
    .from("contact_info")
    .select(COLUMNS)
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return data ? toContact(data as ContactRow) : null;
}

// Update the singleton. The client is REQUIRED (no admin default) — /admin/contact passes
// the editor SESSION client so RLS enforces the editor role; a non-editor matches 0 rows
// and `.single()` throws PGRST116. Social URLs are validated first (ContactUrlError).
export async function updateContactInfo(
  input: UpdateContactInput,
  supabase: SupabaseClient,
): Promise<ContactInfo> {
  assertSocialUrlAllowed(input.facebookUrl, FACEBOOK_HOSTS, "Facebook URL");
  assertSocialUrlAllowed(input.instagramUrl, INSTAGRAM_HOSTS, "Instagram URL");

  const { data, error } = await supabase
    .from("contact_info")
    .update({
      email: input.email,
      phone: input.phone,
      address: input.address,
      facebook_url: input.facebookUrl,
      instagram_url: input.instagramUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toContact(data as ContactRow);
}
