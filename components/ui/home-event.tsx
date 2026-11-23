import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AccentRule } from "@/components/ui/motifs/accent-rule";
import { StripeEdge } from "@/components/ui/motifs/stripe-edge";
import { safeStoredImageHref } from "@/lib/safe-image-url";

// What the band shows — the next tournament (schedule S3), already localized by the caller.
export interface HomeEventBandData {
  name: string;
  href: string; // e.g. /tournaments/{slug}
  dates: string; // formatted window; '' → omitted
  dateTime?: string; // machine-readable start for <time>
  venue: string; // city, country; '' → omitted
  coverImageUrl: string;
}

// The band's words, from the caller's locale dictionary (home.event*).
export interface HomeEventBandLabels {
  eyebrow: string;
  details: string;
  dates: string;
  location: string;
}

// The home "Upcoming Event" band (design guide §2.4): one full-bleed navy band for the next
// tournament — eyebrow, name, date + place rows, and a gold "Event details" button. With a cover
// photo it fills the right ~45% on lg (masked into the navy) and sits on top at 16:9 on
// mobile; without one the band is navy + the stripe edge only. The caller omits the band
// when nothing is upcoming. Never render travel itineraries here (safeguarding — the
// description is not shown on the band). `inset` is the home-feed interstitial (H10): a rounded
// card inside the feed column instead of a full-bleed band.
export function HomeEventBand({
  event,
  labels,
  variant = "band",
}: {
  event: HomeEventBandData;
  labels: HomeEventBandLabels;
  variant?: "band" | "inset";
}) {
  const inset = variant === "inset";
  const cover = safeStoredImageHref(event.coverImageUrl);
  const dates = event.dates;

  return (
    <section
      data-testid="home-event"
      aria-labelledby="home-event-heading"
      className={`relative isolate overflow-hidden bg-navy text-navy-foreground ${inset ? "rounded-2xl" : ""}`}
    >
      {cover ? (
        <div
          className={`relative aspect-video w-full ${inset ? "sm:absolute sm:inset-y-0 sm:right-0 sm:aspect-auto sm:w-[40%]" : "lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[45%]"}`}
        >
          <Image
            src={cover}
            alt=""
            fill
            sizes={inset ? "(min-width: 640px) 320px, 100vw" : "(min-width: 1024px) 45vw, 100vw"}
            className="object-cover"
          />
          <div
            className={`absolute inset-0 bg-gradient-to-t from-navy to-transparent ${inset ? "sm:bg-gradient-to-r sm:from-navy sm:via-navy/40" : "lg:bg-gradient-to-r lg:from-navy lg:via-navy/40"}`}
          />
        </div>
      ) : null}
      {inset ? null : <StripeEdge className="hidden sm:flex" />}

      <div
        className={
          inset
            ? "relative flex flex-col gap-4 p-6 sm:max-w-[62%] sm:p-8"
            : "relative mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-14 sm:px-6 sm:py-20"
        }
      >
        <div className="flex items-center gap-4">
          <AccentRule />
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent sm:text-base">
            {labels.eyebrow}
          </p>
        </div>
        <h2
          id="home-event-heading"
          data-testid="home-event-name"
          className={`max-w-2xl font-display font-bold leading-tight tracking-tight ${inset ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl lg:text-5xl"}`}
        >
          {event.name}
        </h2>
        <ul className={`flex flex-col gap-2 ${inset ? "" : "text-lg"}`}>
          {dates ? (
            <li className="flex items-center gap-3">
              <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-accent" />
              <span className="sr-only">{labels.dates} </span>
              <time data-testid="home-event-dates" dateTime={event.dateTime}>
                {dates}
              </time>
            </li>
          ) : null}
          {event.venue ? (
            <li className="flex items-center gap-3">
              <MapPin aria-hidden="true" className="size-5 shrink-0 text-accent" />
              <span className="sr-only">{labels.location} </span>
              <span data-testid="home-event-venue">{event.venue}</span>
            </li>
          ) : null}
        </ul>
        <Link
          href={event.href}
          data-testid="home-event-link"
          className={`${buttonVariants({ variant: "accent", size: "cta" })} mt-2 w-fit`}
        >
          {labels.details}
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
