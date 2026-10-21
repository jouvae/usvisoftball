// The curved white→navy edge with a gold stroke that opens the footer. Sits directly above the
// navy footer; the SVG stretches to full width (preserveAspectRatio="none").
export function FooterSwoosh({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={`block h-10 w-full sm:h-16 ${className}`}
    >
      <path d="M0 80V18C360 70 900 74 1440 6V80Z" className="fill-navy" />
      <path
        d="M760 64C1000 56 1230 40 1440 6"
        fill="none"
        strokeWidth="4"
        className="stroke-accent"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
