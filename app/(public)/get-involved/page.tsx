import type { Metadata } from "next";
import { ArrowUpRight, Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { INVOLVEMENT, type Involvement } from "@/components/ui/get-involved";
import { AccentRule } from "@/components/ui/motifs/accent-rule";
import { getContactInfo } from "@/lib/contact";

// Reads the contact_info singleton via supabase-js (NOT `fetch`) for the enquiry mailto links,
// so render per request — the Fly build is env-free and must not touch Supabase at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get Involved — USVI Softball Federation",
  description:
    "Play, coach, umpire, volunteer, or support USVI softball — every way to be part of the game in the U.S. Virgin Islands.",
};

// Longer copy per audience (the cards' one-line summaries live in INVOLVEMENT). Draft copy —
// to be reviewed by the Federation.
const DETAILS: Record<Involvement["id"], { body: string[]; subject?: string }> = {
  athletes: {
    body: [
      "Softball in the Virgin Islands runs from youth leagues on all three islands through to the women's and U18 girls' national teams that represent the territory abroad.",
      "Tell us the athlete's age, island, and experience, and we'll point you to the right league, clinic, or national-team identification opportunity.",
    ],
    subject: "Athlete / parent enquiry",
  },
  volunteers: {
    body: [
      "Every game needs coaches, umpires, scorekeepers, and volunteers. No experience? We'll help you get trained and certified.",
      "Let us know which role interests you and which island you're on.",
    ],
    subject: "Coach / umpire / volunteer enquiry",
  },
  support: {
    body: [
      "International competition means flights, accommodation, uniforms, and entry fees. Donations go directly toward getting our athletes to the field.",
      "For sponsorship or partnership opportunities, email us and we'll be in touch.",
    ],
    subject: "Sponsorship enquiry",
  },
};

export default async function GetInvolvedPage() {
  const contact = await getContactInfo().catch(() => null);
  const email = contact?.email ?? "";

  return (
    <div className="flex flex-1 flex-col">
      <section className="bg-navy text-navy-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-16 sm:px-6 sm:py-20">
          <AccentRule />
          <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
            Get Involved
          </h1>
          <p className="max-w-2xl text-lg text-navy-muted">
            Softball in the Virgin Islands is built by its community. Here&apos;s how you
            can be part of it.
          </p>
          <nav aria-label="On this page" className="mt-2 flex flex-wrap gap-3">
            {INVOLVEMENT.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium outline-accent hover:bg-white/10 focus:outline-2 focus:outline-offset-2"
              >
                {item.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col divide-y divide-border px-4 sm:px-6">
        {INVOLVEMENT.map((item) => {
          const Icon = item.icon;
          const details = DETAILS[item.id];
          const mailto =
            email && details.subject
              ? `mailto:${email}?subject=${encodeURIComponent(details.subject)}`
              : "";

          return (
            <section
              key={item.id}
              id={item.id}
              data-testid={`involved-section-${item.id}`}
              aria-labelledby={`${item.id}-heading`}
              className="grid scroll-mt-24 gap-6 py-14 sm:py-16 lg:grid-cols-[auto_1fr] lg:gap-10"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-navy text-accent">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <div className="flex max-w-prose flex-col gap-4">
                <h2
                  id={`${item.id}-heading`}
                  className="font-display text-3xl font-bold uppercase tracking-tight text-navy sm:text-4xl"
                >
                  {item.title}
                </h2>
                <p className="text-lg text-foreground">{item.summary}</p>
                {details.body.map((para) => (
                  <p key={para} className="leading-relaxed text-muted">
                    {para}
                  </p>
                ))}
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  {item.cta.external ? (
                    <a
                      href={item.cta.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`involved-page-cta-${item.id}`}
                      className={buttonVariants({ variant: "accent", size: "cta" })}
                    >
                      {item.cta.label}
                      <ArrowUpRight aria-hidden="true" />
                      <span className="sr-only"> (opens PayPal)</span>
                    </a>
                  ) : null}
                  {mailto ? (
                    <a
                      href={mailto}
                      data-testid={`involved-email-${item.id}`}
                      className={buttonVariants({
                        variant: item.cta.external ? "outline-light" : "accent",
                        size: "cta",
                      })}
                    >
                      <Mail aria-hidden="true" />
                      Email the Federation
                    </a>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
