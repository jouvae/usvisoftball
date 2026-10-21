// A gold parallelogram tucked into a card or band corner (comp: team cards, hero). The parent
// must be `relative` (and `overflow-hidden` if the slash should clip at the edge).
const CORNER = {
  tr: "top-0 right-0",
  br: "bottom-0 right-0",
} as const;

export function CornerSlash({
  corner = "br",
  className = "",
}: {
  corner?: keyof typeof CORNER;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute size-14 bg-accent [clip-path:polygon(55%_0,100%_0,45%_100%,0_100%)] ${CORNER[corner]} ${className}`}
    />
  );
}
