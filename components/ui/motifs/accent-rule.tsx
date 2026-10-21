// The gold heading rule — the comp's most repeated motif (section headers, hero, event band,
// footer tagline). Decorative only: gold on white is 1.5:1, so it never carries meaning.
export function AccentRule({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-1.5 w-12 shrink-0 rounded-full bg-accent ${className}`}
    />
  );
}
