import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AccentRule } from "@/components/ui/motifs/accent-rule";

export type SectionHeaderProps = {
  title: string;
  // The <h2> id — the section's `aria-labelledby` points at it.
  id: string;
  // The action label must NAME the destination ("All teams"), never a tagline.
  action?: { href: string; label: string; testId?: string };
  tone?: "light" | "dark";
  className?: string;
};

// The comp's repeated section header: gold rule · UPPERCASE condensed title · a right-aligned
// "label →" link. On mobile the rule stacks above the title and the action drops below it.
export function SectionHeader({
  title,
  id,
  action,
  tone = "light",
  className = "",
}: SectionHeaderProps) {
  const titleColor = tone === "dark" ? "text-navy-foreground" : "text-navy";
  const actionColor =
    tone === "dark"
      ? "text-navy-foreground hover:text-accent outline-accent"
      : "text-brand hover:text-brand-hover outline-focus";

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <AccentRule />
        <h2
          id={id}
          className={`font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl ${titleColor}`}
        >
          {title}
        </h2>
      </div>
      {action ? (
        <Link
          href={action.href}
          data-testid={action.testId}
          className={`inline-flex w-fit items-center gap-1.5 font-display font-semibold tracking-wide focus:outline-2 focus:outline-offset-2 ${actionColor}`}
        >
          {action.label}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}
