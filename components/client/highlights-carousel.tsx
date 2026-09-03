"use client";

import { useRef } from "react";

// The home highlights carousel (MVP slice 4). A CLIENT island purely for the scroll
// controls — the cards themselves are pre-rendered SERVER components (ArticleCard)
// passed in as `children` (server-in-client composition: the client boundary never
// re-renders them, it only arranges + scrolls them). The track is a horizontal
// scroll-snap list, so it is fully usable with NO JavaScript (native touch / trackpad
// scroll + keyboard focus); the prev/next buttons are a progressive enhancement that
// scrollBy ~one viewport. `role="list"` is explicit because some resets strip <ul>
// semantics. Each child card receives its own snap/width classes from the caller.
export function HighlightsCarousel({
  children,
}: {
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLUListElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.85 * dir, behavior: "smooth" });
  };

  return (
    <div data-testid="highlights-carousel" className="flex flex-col gap-3">
      <ul
        ref={trackRef}
        role="list"
        data-testid="highlights-track"
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2"
      >
        {children}
      </ul>

      <div className="flex gap-2 self-end">
        <button
          type="button"
          onClick={() => scroll(-1)}
          data-testid="highlights-prev"
          aria-label="Previous highlights"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-brand bg-background text-lg text-brand outline-focus hover:bg-surface focus:outline-2"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          data-testid="highlights-next"
          aria-label="Next highlights"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-brand bg-background text-lg text-brand outline-focus hover:bg-surface focus:outline-2"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}
