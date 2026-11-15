import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// /robots.txt (schedule-web-023): crawl everything public, never the admin, and find the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/admin" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
