"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { useDictionary, useLocale } from "@/lib/i18n/client";
import { FEED_AUTO_PAGES, type FeedPage, type FeedStory } from "@/lib/feed-view";
import { FeedStoryRow } from "@/components/ui/feed-story";

// Feature softball/home-feed — the "Latest" list under the lead story (H5, H6).
//   • Infinite scroll: a sentinel loads the next page as it nears the viewport, for at most
//     FEED_AUTO_PAGES pages; after that (and always, as a fallback) the real "Load more" button
//     loads — so the footer stays reachable.
//   • Refresh: every 60 s while the tab is visible it asks /api/feed for stories newer than the
//     newest one shown; they wait behind an "N new stories" pill until the reader taps it. A new
//     highlight re-renders the server rail via router.refresh() (this list's state is kept).
// Interstitials (the next-tournament band, the stats strip) are server-rendered nodes placed
// after a given story id.

const POLL_MS = 60_000;

export interface FeedInterstitial {
  afterId: string;
  testId: string;
  node: ReactNode;
}

function maxIso(a: string | null, b: string | null | undefined): string | null {
  if (!b) return a;
  if (!a) return b;
  return Date.parse(b) > Date.parse(a) ? b : a;
}

export function HomeFeedList({
  initialStories,
  initialCursor,
  leadId,
  newestAt,
  highlightAt,
  interstitials = [],
}: {
  initialStories: FeedStory[];
  initialCursor: string | null;
  leadId: string | null;
  newestAt: string | null;
  highlightAt: string | null;
  interstitials?: FeedInterstitial[];
}) {
  const locale = useLocale();
  const t = useDictionary().home;
  const router = useRouter();

  const [stories, setStories] = useState(initialStories);
  const [cursor, setCursor] = useState(initialCursor);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [pending, setPending] = useState<FeedStory[]>([]);
  const autoLoads = useRef(0);
  const newest = useRef(newestAt);
  const highlightMark = useRef(highlightAt);
  const sentinel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || status === "loading") return;
    setStatus("loading");
    try {
      const qs = new URLSearchParams({ cursor, lang: locale });
      if (leadId) qs.set("exclude", leadId);
      const res = await fetch(`/api/feed?${qs}`);
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as FeedPage;
      setStories((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...page.stories.filter((s) => !seen.has(s.id))];
      });
      setCursor(page.nextCursor);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [cursor, status, locale, leadId]);

  // Auto-load while the sentinel nears the viewport, capped.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || status !== "idle" || autoLoads.current >= FEED_AUTO_PAGES) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          autoLoads.current += 1;
          io.disconnect();
          void loadMore();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, status, loadMore]);

  // Poll for newer stories + highlights.
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible" || !newest.current) return;
      try {
        const qs = new URLSearchParams({ since: newest.current, lang: locale });
        const res = await fetch(`/api/feed?${qs}`);
        if (!res.ok) return;
        const body = (await res.json()) as { stories: FeedStory[]; latestHighlightAt: string | null };
        if (body.stories.length) {
          setPending((prev) => {
            const seen = new Set(prev.map((s) => s.id));
            return [...body.stories.filter((s) => !seen.has(s.id) && s.id !== leadId), ...prev];
          });
        }
        if (body.latestHighlightAt && body.latestHighlightAt !== highlightMark.current) {
          highlightMark.current = body.latestHighlightAt;
          router.refresh();
        }
      } catch {
        // A missed poll is harmless; the next one retries.
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [locale, leadId, router]);

  function showPending() {
    setStories((prev) => {
      const seen = new Set(prev.map((s) => s.id));
      return [...pending.filter((s) => !seen.has(s.id)), ...prev];
    });
    newest.current = pending.reduce<string | null>((m, s) => maxIso(m, s.publishedAt), newest.current);
    setPending([]);
    heading.current?.scrollIntoView({ block: "start" });
    heading.current?.focus({ preventScroll: true });
  }

  const after = new Map(interstitials.map((i) => [i.afterId, i]));

  return (
    <section aria-labelledby="home-latest-heading" className="flex flex-col">
      <h2
        id="home-latest-heading"
        ref={heading}
        tabIndex={-1}
        className="scroll-mt-24 border-b-2 border-navy pb-2 font-display text-2xl font-bold tracking-tight text-navy outline-none"
      >
        {t.latest}
      </h2>

      {pending.length > 0 ? (
        <div className="sticky top-20 z-10 flex justify-center pt-3">
          <button
            type="button"
            data-testid="feed-new-stories"
            onClick={showPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 font-display text-sm font-semibold tracking-wide text-navy-foreground shadow-lg outline-focus animate-in fade-in slide-in-from-top-2 focus:outline-2 focus:outline-offset-2 motion-reduce:animate-none"
          >
            <ArrowUp aria-hidden="true" className="size-4" />
            {pending.length === 1 ? t.newStory : t.newStories.replace("{n}", String(pending.length))}
          </button>
        </div>
      ) : null}

      <ul role="list" data-testid="home-feed" aria-busy={status === "loading"}>
        {stories.map((story) => {
          const inter = after.get(story.id);
          return (
            <Fragment key={story.id}>
              <FeedStoryRow story={story} locale={locale} />
              {inter ? (
                <li data-testid={inter.testId} className="border-b border-border py-6">
                  {inter.node}
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ul>

      <div ref={sentinel} aria-hidden="true" />

      <p role="status" className="sr-only">
        {status === "loading" ? t.loading : ""}
      </p>

      <div className="flex flex-col items-start gap-3 pt-6">
        {status === "error" ? (
          <p data-testid="feed-error" className="text-sm text-muted">
            {t.loadError}
          </p>
        ) : null}
        {cursor ? (
          <button
            type="button"
            data-testid="feed-load-more"
            onClick={() => void loadMore()}
            disabled={status === "loading"}
            className="inline-flex min-h-11 items-center rounded-md border border-navy px-5 font-display font-semibold tracking-wide text-navy outline-focus hover:bg-surface focus:outline-2 focus:outline-offset-2 disabled:opacity-60"
          >
            {status === "loading" ? t.loading : t.loadMore}
          </button>
        ) : stories.length > 0 ? (
          <p data-testid="feed-end" className="text-sm text-muted">
            {t.feedEnd}
          </p>
        ) : null}
      </div>
    </section>
  );
}
