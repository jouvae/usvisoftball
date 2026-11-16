"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";

export type SheetPresentation = "modal" | "drawer";

// Tailwind's `md` breakpoint: a centered modal at ≥ md, a bottom drawer below it (D7).
const DESKTOP_QUERY = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// null on the server (and before hydration) → render nothing until the viewport is known, so
// the wrong overlay never flashes.
function usePresentation(): SheetPresentation | null {
  return useSyncExternalStore<SheetPresentation | null>(
    subscribe,
    () => (window.matchMedia(DESKTOP_QUERY).matches ? "modal" : "drawer"),
    () => null,
  );
}

// The one Modal/Drawer wrapper (D12): Base UI Dialog at ≥ md, Base UI Drawer (bottom sheet,
// swipe-to-dismiss) below. Always open while mounted; any dismissal (Escape, backdrop, close
// button, swipe) calls `onClose` — the route-driven caller pops history so Back and close agree.
// `children` is a render prop so the content can state its own presentation.
export function ResponsiveSheet({
  title,
  closeLabel,
  onClose,
  modalTestId,
  drawerTestId,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  modalTestId?: string;
  drawerTestId?: string;
  children: (presentation: SheetPresentation) => ReactNode;
}) {
  const presentation = usePresentation();
  if (!presentation) return null;
  const onOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  const closeButton =
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-navy outline-focus transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2";

  if (presentation === "modal") {
    return (
      <Dialog.Root open onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
            <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
              <Dialog.Popup
                data-testid={modalTestId}
                className="relative my-auto w-full max-w-3xl rounded-2xl bg-white shadow-2xl outline-none ring-1 ring-black/5 transition-[opacity,translate] duration-200 data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0"
              >
                <div className="h-1.5 rounded-t-2xl bg-accent" aria-hidden="true" />
                <div className="flex items-center justify-between gap-4 px-6 pt-4">
                  <Dialog.Title className="sr-only">{title}</Dialog.Title>
                  <span aria-hidden="true" />
                  <Dialog.Close aria-label={closeLabel} className={closeButton}>
                    <X aria-hidden="true" className="size-5" />
                  </Dialog.Close>
                </div>
                <div className="px-6 pb-8">{children("modal")}</div>
              </Dialog.Popup>
            </div>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Drawer.Root open onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-navy opacity-[calc(0.6*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
          <Drawer.Popup
            data-testid={drawerTestId}
            className="-mb-12 max-h-[calc(92dvh+3rem)] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white pb-[calc(1.5rem+env(safe-area-inset-bottom,0px)+3rem)] shadow-2xl outline-none [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none data-ending-style:[transform:translateY(calc(100%-3rem+2px))] data-starting-style:[transform:translateY(calc(100%-3rem+2px))]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-3xl bg-white/95 px-4 pt-2 backdrop-blur">
              <span aria-hidden="true" className="size-11" />
              <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-border" />
              <Drawer.Close aria-label={closeLabel} className={closeButton}>
                <X aria-hidden="true" className="size-5" />
              </Drawer.Close>
            </div>
            <Drawer.Content className="px-4 pb-4">
              <Drawer.Title className="sr-only">{title}</Drawer.Title>
              {children("drawer")}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
