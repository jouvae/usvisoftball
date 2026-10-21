// Stylised outlines of St. Thomas, St. John (north) and St. Croix (south), in their rough
// relative positions. Decorative texture only (footer, stats strip) — not a map; the shapes
// are simplified by hand. Colour/opacity comes from the caller via `className` (fill-*).
export function IslandSilhouettes({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 240" className={className}>
      {/* St. Thomas */}
      <path d="M18 52l14-12 20 2 12-8 18 6 16-6 22 4 14-8 18 6 10 10-12 8-20-2-16 8-14-4-18 6-20-4-16 6-20-2-14-4z" />
      {/* St. John */}
      <path d="M178 44l14-10 16 2 12-6 14 6 6 10-10 8-14-2-12 8-14-4-10-6z" />
      {/* St. Croix */}
      <path d="M52 184l22-14 30-2 24-10 34 2 28-8 36 4 30-6 34 6 26-4 18 8-12 12-30 4-26 10-34-2-30 8-36-4-32 6-30-4-28 6-22-6z" />
    </svg>
  );
}
