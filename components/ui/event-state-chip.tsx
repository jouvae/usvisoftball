import { getDictionary } from "@/lib/i18n/dictionaries";
import { runTotals, type EventWithGame, type Locale } from "@/lib/schedule-view";

type Tone = "upcoming" | "live" | "final" | "alert";

// The state of an event as a label + tone: a postponed/cancelled status wins; then the game
// state (pregame → Upcoming, live → Live · Inning n, final → "Final · 3–1", away–home).
// Ceremonies → Upcoming. The "upcoming" tone is rendered visually hidden (no chip on screen).
export function eventState(
  event: Pick<EventWithGame, "status" | "game">,
  locale: Locale,
): { label: string; tone: Tone } {
  const t = getDictionary(locale).schedule;
  if (event.status === "postponed") return { label: t.statePostponed, tone: "alert" };
  if (event.status === "cancelled") return { label: t.stateCancelled, tone: "alert" };
  const g = event.game;
  if (g?.state === "final") {
    const r = runTotals(g.innings);
    return { label: `${t.stateFinal} · ${r.away}–${r.home}`, tone: "final" };
  }
  if (g?.state === "live") {
    return {
      label: g.currentInning ? `${t.stateLive} · ${t.inning} ${g.currentInning}` : t.stateLive,
      tone: "live",
    };
  }
  return { label: t.stateUpcoming, tone: "upcoming" };
}

const CHIP =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 font-display text-xs font-semibold uppercase tracking-wider";
const TONES: Record<Exclude<Tone, "upcoming">, string> = {
  live: "bg-red-600 text-white",
  final: "bg-navy text-navy-foreground",
  alert: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
};

// The small state pill shared by list rows, cards and the event header. Only Live, Final (with
// the score), Postponed and Cancelled show a chip; a pregame/upcoming event keeps the testid as
// a visually-hidden label for screen readers. Live pulses (motion-safe only). Isomorphic.
export function EventStateChip({
  event,
  locale,
  testId,
  className = "",
}: {
  event: Pick<EventWithGame, "status" | "game">;
  locale: Locale;
  testId?: string;
  className?: string;
}) {
  const { label, tone } = eventState(event, locale);
  if (tone === "upcoming") {
    return (
      <span data-testid={testId} data-tone={tone} className="sr-only">
        {label}
      </span>
    );
  }
  return (
    <span
      data-testid={testId}
      data-tone={tone}
      className={`${CHIP} ${TONES[tone]} ${className}`}
    >
      {tone === "live" ? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-white motion-safe:animate-pulse" />
      ) : null}
      {label}
    </span>
  );
}
