import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/sitemap";

// /sitemap.xml (schedule-web-023): every public page in en + es with hreflang alternates.
// force-dynamic: it reads Supabase, which the env-free production build cannot reach — so it is
// rendered per request instead of prerendered at build time.
export const dynamic = "force-dynamic";

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries();
}
