"use client";

import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { MinusSmallIcon, PlusSmallIcon } from "@heroicons/react/24/outline";

export type Faq = { question: string; answer: string };

// PLACEHOLDER content (redesign) — the federation will replace these before launch.
const DEFAULT_FAQS: Faq[] = [
  {
    question: "How do I register a team for the season?",
    answer:
      "Placeholder answer. Registration details, deadlines, and the sign-up form will be published here before each season opens.",
  },
  {
    question: "Where are games and tournaments held?",
    answer:
      "Placeholder answer. Games are played across St. Thomas, St. John, and St. Croix; specific venues and schedules are posted on the Articles page.",
  },
  {
    question: "How can I get involved as a volunteer or official?",
    answer:
      "Placeholder answer. Reach out through the contact information below and the board will connect you with the right committee.",
  },
  {
    question: "How is the Federation governed?",
    answer:
      "Placeholder answer. The Federation is led by an elected board representing St. Thomas/St. John, St. Croix, and at-large seats — see the board above.",
  },
];

// FAQ accordion (redesign, adapted from the Tailwind UI FAQ pattern). Client island for the
// disclosure toggle. Each item is a headlessui Disclosure; the +/- icon swaps on open.
export function FaqSection({
  faqs = DEFAULT_FAQS,
  className = "",
}: {
  faqs?: Faq[];
  className?: string;
}) {
  return (
    <section data-testid="about-faq" className={`flex flex-col gap-6 ${className}`}>
      <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-navy">
        Frequently asked questions
      </h2>
      <dl className="divide-y divide-border">
        {faqs.map((faq) => (
          <Disclosure key={faq.question} as="div" className="py-6">
            <dt>
              <DisclosureButton
                data-testid="faq-question"
                className="group flex w-full items-start justify-between text-left text-foreground outline-focus focus:outline-2"
              >
                <span className="font-display text-base font-semibold">
                  {faq.question}
                </span>
                <span className="ml-6 flex h-7 items-center text-brand">
                  <PlusSmallIcon
                    aria-hidden="true"
                    className="size-6 group-data-open:hidden"
                  />
                  <MinusSmallIcon
                    aria-hidden="true"
                    className="size-6 hidden group-data-open:block"
                  />
                </span>
              </DisclosureButton>
            </dt>
            <DisclosurePanel as="dd" className="mt-2 pr-12">
              <p data-testid="faq-answer" className="text-muted">
                {faq.answer}
              </p>
            </DisclosurePanel>
          </Disclosure>
        ))}
      </dl>
    </section>
  );
}
