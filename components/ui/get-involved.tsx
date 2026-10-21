import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ArrowUpRight, Flag, Heart, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { PAYPAL_DONATE_URL } from "@/lib/flags";

// The three audiences the Federation serves (design guide §2.6). Shared by the home "Get
// Involved" section and the /get-involved page so the two never drift. Static copy for now —
// to be reviewed by the Federation.
export type Involvement = {
  id: "athletes" | "volunteers" | "support";
  title: string;
  summary: string;
  icon: LucideIcon;
  cta: { label: string; href: string; external: boolean };
};

export const INVOLVEMENT: Involvement[] = [
  {
    id: "athletes",
    title: "Athletes & Parents",
    summary:
      "Be part of the pathway. Learn about the national teams, development opportunities, and how to get started.",
    icon: Users,
    cta: { label: "Join the pathway", href: "/get-involved#athletes", external: false },
  },
  {
    id: "volunteers",
    title: "Coaches, Umpires & Volunteers",
    summary:
      "Help grow the game. Join a community of dedicated leaders on and off the field.",
    icon: Flag,
    cta: { label: "Volunteer with us", href: "/get-involved#volunteers", external: false },
  },
  {
    id: "support",
    title: "Support USVI Softball",
    summary:
      "Your support helps our athletes compete, travel, and represent the Virgin Islands with pride.",
    icon: Heart,
    cta: { label: "Support the Federation", href: PAYPAL_DONATE_URL, external: true },
  },
];

// One audience card. The whole card is the click target (the CTA's `absolute inset-0`
// span), so there is one link per card and its accessible name is the CTA label plus,
// for the external one, "(opens PayPal)".
function InvolvementCard({
  item,
  className = "",
}: {
  item: Involvement;
  className?: string;
}) {
  const Icon = item.icon;
  const label = (
    <>
      <span className="absolute inset-0 rounded-2xl" aria-hidden="true" />
      {item.cta.label}
      {item.cta.external ? (
        <>
          <ArrowUpRight aria-hidden="true" />
          <span className="sr-only"> (opens PayPal)</span>
        </>
      ) : (
        <ArrowRight aria-hidden="true" />
      )}
    </>
  );
  const ctaClass = `${buttonVariants({ variant: "accent", size: "cta" })} mt-auto focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus`;

  return (
    <li
      data-testid={`involved-card-${item.id}`}
      className={`group relative flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-border transition-shadow hover:shadow-md ${className}`}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-navy text-accent">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <h3 className="font-display text-xl font-bold tracking-tight text-navy sm:text-2xl">
        {item.title}
      </h3>
      <p className="mb-2 text-muted">{item.summary}</p>
      {item.cta.external ? (
        <a
          href={item.cta.href}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`involved-cta-${item.id}`}
          className={ctaClass}
        >
          {label}
        </a>
      ) : (
        <Link
          href={item.cta.href}
          data-testid={`involved-cta-${item.id}`}
          className={ctaClass}
        >
          {label}
        </Link>
      )}
    </li>
  );
}

// Home "Get Involved" section — tinted surface, three audience cards.
export function GetInvolvedSection() {
  return (
    <section
      data-testid="home-involved"
      aria-labelledby="home-involved-heading"
      className="bg-surface"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader
          id="home-involved-heading"
          title="Get Involved"
          action={{
            href: "/get-involved",
            label: "Ways to get involved",
            testId: "home-involved-link",
          }}
        />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {INVOLVEMENT.map((item, i) => (
            <InvolvementCard
              key={item.id}
              item={item}
              // Three-up on sm (2 columns): the last card spans both so none is orphaned.
              className={i === INVOLVEMENT.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
