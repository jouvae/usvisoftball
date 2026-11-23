import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ArrowUpRight, Flag, Heart, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizePath, type Locale } from "@/lib/i18n/locale";

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

// The three ways in, in the given locale (dictionary home.*). Hrefs are internal paths; the
// card localizes them. /get-involved (English-only body copy) uses INVOLVEMENT.
export function involvementItems(locale: Locale): Involvement[] {
  const t = getDictionary(locale).home;
  return [
    {
      id: "athletes",
      title: t.athletesTitle,
      summary: t.athletesSummary,
      icon: Users,
      cta: { label: t.athletesCta, href: "/get-involved#athletes", external: false },
    },
    {
      id: "volunteers",
      title: t.volunteersTitle,
      summary: t.volunteersSummary,
      icon: Flag,
      cta: { label: t.volunteersCta, href: "/get-involved#volunteers", external: false },
    },
    {
      id: "support",
      title: t.supportTitle,
      summary: t.supportSummary,
      icon: Heart,
      cta: { label: t.supportCta, href: "/donate", external: false },
    },
  ];
}

export const INVOLVEMENT: Involvement[] = involvementItems("en");

// One audience card. The whole card is the click target (the CTA's `absolute inset-0`
// span), so there is one link per card and its accessible name is the CTA label plus,
// for the external one, "(opens PayPal)".
function InvolvementCard({
  item,
  locale,
  className = "",
}: {
  item: Involvement;
  locale: Locale;
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
          <span className="sr-only"> {getDictionary(locale).footer.opensPaypal}</span>
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
          href={localizePath(locale, item.cta.href)}
          data-testid={`involved-cta-${item.id}`}
          data-support-cta={item.id === "support" ? "home_involved" : undefined}
          className={ctaClass}
        >
          {label}
        </Link>
      )}
    </li>
  );
}

// Home "Get Involved" section — tinted surface, three audience cards.
export function GetInvolvedSection({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).home;
  const items = involvementItems(locale);
  return (
    <section
      data-testid="home-involved"
      aria-labelledby="home-involved-heading"
      className="bg-surface"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader
          id="home-involved-heading"
          title={t.involvedTitle}
          action={{
            href: localizePath(locale, "/get-involved"),
            label: t.involvedLink,
            testId: "home-involved-link",
          }}
        />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {items.map((item, i) => (
            <InvolvementCard
              key={item.id}
              item={item}
              locale={locale}
              // Three-up on sm (2 columns): the last card spans both so none is orphaned.
              className={i === items.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
