"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The home highlights carousel (MVP slice 4). A CLIENT island purely for the scroll
// controls — the cards themselves are pre-rendered SERVER components (ArticleCard)
// passed in as `children` (server-in-client composition: the client boundary never
// re-renders them, it only arranges + scrolls them). The track is a horizontal
// scroll-snap list, so it is fully usable with NO JavaScript (native touch / trackpad
// scroll + keyboard focus); the prev/next buttons are a progressive enhancement that
// step exactly one card (card width + gap), so each click lands on a snap point.
// `role="list"` is explicit because some resets strip <ul> semantics. Each child card
// receives its own snap/width classes from the caller.
//
// At either end the matching button is `aria-disabled` (announced + dimmed) rather than
// natively `disabled`, so it stays focusable/visible and a click is a harmless no-op —
// without that cue a click at the end looked like a broken control.
export function HighlightsCarousel({
  children,
}: {
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEnds = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // 1px tolerance: fractional scroll positions on high-DPI screens never hit exactly 0/max.
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateEnds();
    el.addEventListener("scroll", updateEnds, { passive: true });
    const resize = new ResizeObserver(updateEnds);
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEnds);
      resize.disconnect();
    };
  }, [updateEnds]);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: (card.offsetWidth + gap) * dir, behavior: "smooth" });
  };

  const buttonClass =
    "flex h-10 w-10 items-center justify-center rounded-full border border-brand bg-background text-lg text-brand outline-focus hover:bg-surface focus:outline-2 aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:bg-background";

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
          onClick={() => !atStart && scroll(-1)}
          data-testid="highlights-prev"
          aria-label="Previous highlights"
          aria-disabled={atStart || undefined}
          className={buttonClass}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          onClick={() => !atEnd && scroll(1)}
          data-testid="highlights-next"
          aria-label="Next highlights"
          aria-disabled={atEnd || undefined}
          className={buttonClass}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}
