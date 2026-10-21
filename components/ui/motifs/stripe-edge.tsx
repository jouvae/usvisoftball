// Two diagonal bands (gold, then navy-raised) on a band's right edge — the comp's event-band
// treatment. The parent must be `relative overflow-hidden`.
export function StripeEdge({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 right-0 flex w-24 ${className}`}
    >
      <span className="h-full w-1/2 bg-accent [clip-path:polygon(60%_0,100%_0,40%_100%,0_100%)]" />
      <span className="-ml-3 h-full w-1/2 bg-navy-raised [clip-path:polygon(60%_0,100%_0,40%_100%,0_100%)]" />
    </span>
  );
}
