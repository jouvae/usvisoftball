import type { NextRequest } from "next/server";
import {
  decodeFeedCursor,
  getFeedPage,
  getNewerStories,
  latestHighlightAt,
} from "@/lib/feed";

// The home feed's client fetches (feature softball/home-feed, H5–H6). Public data only — the
// reads go through the RLS-enforced publishable client.
//   ?cursor=…&exclude=<lead id>&lang=es → the next page   { stories, nextCursor }
//   ?since=<iso>&lang=es               → newer stories    { stories, latestHighlightAt }
// /api is never locale-prefixed (proxy.ts), so the language travels as `lang`.
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const locale = params.get("lang") === "es" ? "es" : "en";

  const since = params.get("since");
  if (since !== null) {
    if (Number.isNaN(Date.parse(since))) return json({ error: "bad since" }, 400);
    const [stories, highlightAt] = await Promise.all([
      getNewerStories(since, locale),
      latestHighlightAt(),
    ]);
    return json({ stories, latestHighlightAt: highlightAt });
  }

  const cursor = decodeFeedCursor(params.get("cursor"));
  if (!cursor) return json({ error: "bad cursor" }, 400);
  const exclude = params.get("exclude");
  if (exclude && !UUID_RE.test(exclude)) return json({ error: "bad exclude" }, 400);
  return json(await getFeedPage(cursor, exclude || null, locale));
}
