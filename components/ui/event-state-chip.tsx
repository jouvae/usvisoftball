import { getDictionary } from "@/lib/i18n/dictionaries";
import type { EventWithGame, Locale } from "@/lib/schedule-view";

type Tone = "upcoming" | "live" | "final" | "alert";

// The state of an event as a label + tone: a postponed/cancelled status wins; then the game
// state (pregame → Upcoming, live → Live · Inning n, final → Final). Ceremonies → Upcoming.
export function eventState(
  event: Pick<EventWithGame, "status" | "game">,
  locale: Locale,
): { label: string; tone: Tone } {
  const t = getDictionary(locale).schedule;
  if (event.status === "postponed") return { label: t.statePostponed, tone: "alert" };
  if (event.status === "cancelled") return { label: t.stateCancelled, tone: "alert" };
  const g = event.game;
  if (g?.state === "final") return { label: t.stateFinal, tone: "final" };
  if (g?.state === "live") {
    return {
      label: g.currentInning ? `${t.stateLive} · ${t.inning} ${g.currentInning}` : t.stateLive,
      tone: "live",
    };
  }
  return { label: t.stateUpcoming, tone: "upcoming" };
}

const TONES: Record<Tone, string> = {
  upcoming: "bg-surface text-muted ring-1 ring-border",
  live: "bg-red-600 text-white",
  final: "bg-navy text-navy-foreground",
  alert: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
};

// The small state pill shared by list rows, cards and the event header. Isomorphic.
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
  return (
    <span
      data-testid={testId}
      data-tone={tone}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 font-display text-xs font-semibold uppercase tracking-wider ${TONES[tone]} ${className}`}
    >
      {tone === "live" ? (
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-white" />
      ) : null}
      {label}
    </span>
  );
}
