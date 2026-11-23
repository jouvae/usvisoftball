import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizePath } from "@/lib/i18n/locale";
import { relativeTimeLabel, type HighlightItem } from "@/lib/feed-view";
import type { Locale } from "@/lib/schedule-view";

// Feature softball/home-feed — the text-only highlights rail (H3, H7). The one dark block on the
// page. Desktop: a sticky navy column whose list is a vertical timeline (gold dots — the items
// really are chronological) and scrolls inside itself when taller than the viewport. Phones: the
// same list becomes a horizontal snap strip under the lead story. Server Component; `now` comes
// from the page so every relative time on a render agrees. The caller omits it when empty.

const LINK =
  "inline-flex min-h-11 w-fit items-center gap-1 lg:min-h-0 lg:pt-1 font-display text-sm font-semibold tracking-wide text-accent underline-offset-4 outline-accent hover:underline focus:outline-2 focus:outline-offset-2";

function FinalBody({
  item,
  locale,
}: {
  item: Extract<HighlightItem, { kind: "game_final" }>;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const { line } = item;
  return (
    <>
      <p className="flex flex-wrap items-center gap-2 text-sm text-navy-muted">
        <span className="rounded-sm bg-accent px-1.5 font-display font-semibold uppercase tracking-wide text-accent-foreground">
          {t.schedule.stateFinal}
        </span>
        {line.innings ? <span>{t.home.extraInnings.replace("{n}", String(line.innings))}</span> : null}
      </p>
      <p data-testid="highlight-score" className="font-display text-lg leading-snug">
        <span className="font-bold">
          {line.winner} {line.winnerRuns}
        </span>
        , {line.loser} {line.loserRuns}
      </p>
      {item.tournament ? <p className="text-sm text-navy-muted">{item.tournament}</p> : null}
      <Link
        href={localizePath(locale, `/events/${item.eventSlug}`)}
        data-testid="highlight-link"
        className={LINK}
      >
        {t.home.gameDetails}
      </Link>
    </>
  );
}

function ManualBody({
  item,
  locale,
}: {
  item: Extract<HighlightItem, { kind: "manual" }>;
  locale: Locale;
}) {
  const t = getDictionary(locale).home;
  const external = item.linkUrl?.startsWith("https://") ?? false;
  return (
    <>
      <p className="text-[0.9375rem] leading-[1.45]">{item.text}</p>
      {item.linkUrl ? (
        external ? (
          <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" data-testid="highlight-link" className={LINK}>
            {t.readMore}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
        ) : (
          <Link href={localizePath(locale, item.linkUrl)} data-testid="highlight-link" className={LINK}>
            {t.readMore}
          </Link>
        )
      ) : null}
    </>
  );
}

export function HighlightsRail({
  items,
  locale,
  now,
  className = "",
}: {
  items: HighlightItem[];
  locale: Locale;
  now: Date;
  className?: string;
}) {
  const t = getDictionary(locale).home;
  return (
    <aside
      data-testid="home-highlights"
      aria-labelledby="home-highlights-heading"
      className={`lg:sticky lg:top-20 ${className}`}
    >
      <div className="flex flex-col rounded-2xl bg-navy text-navy-foreground lg:max-h-[calc(100dvh-6rem)]">
        <h2
          id="home-highlights-heading"
          className="px-5 pt-5 pb-3 font-display text-xl font-bold tracking-tight lg:text-2xl"
        >
          {t.highlights}
        </h2>
        <ol
          data-testid="home-highlights-list"
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-5 pb-5 lg:snap-none lg:flex-col lg:gap-0 lg:overflow-x-visible lg:overflow-y-auto lg:overscroll-y-contain"
        >
          {items.map((item, i) => (
            <li
              key={item.id}
              data-testid="highlight-item"
              data-kind={item.kind}
              className={`relative flex w-[80%] shrink-0 snap-start flex-col gap-1.5 rounded-xl bg-navy-raised p-4 sm:w-[45%] lg:w-auto lg:rounded-none lg:bg-transparent lg:p-0 lg:pb-5 lg:pl-6 ${
                i < items.length - 1
                  ? "lg:before:absolute lg:before:top-3 lg:before:bottom-0 lg:before:left-[5px] lg:before:w-px lg:before:bg-white/20"
                  : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="absolute top-1.5 left-0 hidden size-[11px] rounded-full bg-accent ring-4 ring-navy lg:block"
              />
              <time dateTime={item.publishedAt} className="text-sm text-navy-muted">
                {relativeTimeLabel(item.publishedAt, now, locale)}
              </time>
              {item.kind === "game_final" ? (
                <FinalBody item={item} locale={locale} />
              ) : (
                <ManualBody item={item} locale={locale} />
              )}
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
