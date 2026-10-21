import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AccentRule } from "@/components/ui/motifs/accent-rule";
import { StripeEdge } from "@/components/ui/motifs/stripe-edge";
import { safeStoredImageHref } from "@/lib/safe-image-url";
import { formatEventDateRange, type FederationEvent } from "@/lib/events-view";

// The home "Upcoming Event" band (design guide §2.4): one full-bleed navy band for the next
// event — eyebrow, name, date + venue rows, and a gold "Event details" button. With a cover
// photo it fills the right ~45% on lg (masked into the navy) and sits on top at 16:9 on
// mobile; without one the band is navy + the stripe edge only. The caller omits the band
// when nothing is upcoming. Never render travel itineraries here (safeguarding — the
// description is not shown on the band).
export function HomeEventBand({ event }: { event: FederationEvent }) {
  const cover = safeStoredImageHref(event.coverImageUrl);
  const dates = formatEventDateRange(event.startDate, event.endDate);

  return (
    <section
      data-testid="home-event"
      aria-labelledby="home-event-heading"
      className="relative isolate overflow-hidden bg-navy text-navy-foreground"
    >
      {cover ? (
        <div className="relative aspect-video w-full lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[45%]">
          <Image
            src={cover}
            alt=""
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy to-transparent lg:bg-gradient-to-r lg:from-navy lg:via-navy/40" />
        </div>
      ) : null}
      <StripeEdge className="hidden sm:flex" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex items-center gap-4">
          <AccentRule />
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent sm:text-base">
            Upcoming event
          </p>
        </div>
        <h2
          id="home-event-heading"
          data-testid="home-event-name"
          className="max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
        >
          {event.name}
        </h2>
        <ul className="flex flex-col gap-2 text-lg">
          {dates ? (
            <li className="flex items-center gap-3">
              <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-accent" />
              <span className="sr-only">Dates: </span>
              <time data-testid="home-event-dates" dateTime={event.startDate ?? undefined}>
                {dates}
              </time>
            </li>
          ) : null}
          {event.venue ? (
            <li className="flex items-center gap-3">
              <MapPin aria-hidden="true" className="size-5 shrink-0 text-accent" />
              <span className="sr-only">Location: </span>
              <span data-testid="home-event-venue">{event.venue}</span>
            </li>
          ) : null}
        </ul>
        <Link
          href={`/events/${event.slug}`}
          data-testid="home-event-link"
          className={`${buttonVariants({ variant: "accent", size: "cta" })} mt-2 w-fit`}
        >
          Event details
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
