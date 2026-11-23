"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Heart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useDictionary, useLocale } from "@/lib/i18n/client";
import { PAYPAL_DONATE_URL, PAYPAL_HOSTED_BUTTON_ID } from "@/lib/flags";
import { track } from "@/lib/analytics";

// Feature softball/donate — the donation panel, shared by the /donate page and the in-site
// modal/drawer. Our own button opens PayPal's hosted Donate checkout (the Federation's hosted
// button) in PayPal's secure window via PayPal's Donate SDK, so the reader never leaves the
// page. PayPal pages can't be framed, and PayPal login always runs in its own window.

const SDK_SRC = "https://www.paypalobjects.com/donate/sdk/donate-sdk.js";

// What the Donate SDK hands onComplete (PayPal's return query items). All optional: we never
// trust these for money — PayPal is the record — they only feed analytics and the thank-you.
type DonateResult = { tx?: string; st?: string; amt?: string; cc?: string };

type DonationCheckout = (opts: {
  env: "production";
  hosted_button_id: string;
  onComplete: (result: DonateResult) => void;
}) => { renderTo: (win: Window) => unknown };

declare global {
  interface Window {
    PayPal?: { Donation?: { Checkout?: DonationCheckout } };
  }
}

// The page's title is its h1; inside the sheet the dialog's own (sr-only) title already names
// it, so the visible title is presentational there — no duplicate heading for screen readers.
function PanelTitle({ asHeading, children }: { asHeading: boolean; children: React.ReactNode }) {
  const className = "font-display text-3xl font-bold tracking-tight text-navy sm:text-4xl";
  return asHeading ? (
    <h1 className={className}>{children}</h1>
  ) : (
    <p aria-hidden="true" className={className}>
      {children}
    </p>
  );
}

let sdkPromise: Promise<DonationCheckout> | null = null;

function loadDonateSdk(): Promise<DonationCheckout> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<DonationCheckout>((resolve, reject) => {
    const ready = () => {
      const checkout = window.PayPal?.Donation?.Checkout;
      if (checkout) resolve(checkout);
      else reject(new Error("PayPal Donate SDK missing Checkout"));
    };
    if (window.PayPal?.Donation?.Checkout) return ready();
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onload = ready;
    script.onerror = () => reject(new Error("PayPal Donate SDK failed to load"));
    document.head.appendChild(script);
  }).catch((err) => {
    sdkPromise = null; // let a later open retry
    throw err;
  });
  return sdkPromise;
}

type SdkState = { status: "loading" } | { status: "ready"; checkout: DonationCheckout } | { status: "error" };

export function DonatePanel({
  presentation,
}: {
  presentation: "modal" | "drawer" | "page";
}) {
  const t = useDictionary().donate;
  const locale = useLocale();
  const [sdk, setSdk] = useState<SdkState>({ status: "loading" });
  const [done, setDone] = useState<DonateResult | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (!viewed.current) {
      viewed.current = true;
      track({ name: "donate_view", params: { presentation } });
    }
    let live = true;
    loadDonateSdk().then(
      (checkout) => live && setSdk({ status: "ready", checkout }),
      () => {
        if (!live) return;
        setSdk({ status: "error" });
        track({ name: "donate_error", params: { reason: "sdk_unavailable" } });
      },
    );
    return () => {
      live = false;
    };
  }, [presentation]);

  // Synchronous inside the click so the browser lets PayPal open its window.
  function openCheckout() {
    if (sdk.status !== "ready") return;
    track({ name: "donate_begin", params: { method: "paypal_window" } });
    sdk.checkout({
      env: "production",
      hosted_button_id: PAYPAL_HOSTED_BUTTON_ID,
      onComplete: (result) => {
        const value = Number.parseFloat(result?.amt ?? "");
        track({
          name: "donate_complete",
          params: {
            value: Number.isFinite(value) ? value : undefined,
            currency: result?.cc || undefined,
            transaction_id: result?.tx || undefined,
          },
        });
        setDone(result ?? {});
      },
    }).renderTo(window);
  }

  const amount = done?.amt
    ? new Intl.NumberFormat(locale, { style: "currency", currency: done.cc || "USD" }).format(
        Number.parseFloat(done.amt),
      )
    : null;

  if (done) {
    return (
      <div data-testid="donate-thanks" role="status" className="flex flex-col gap-3 py-2">
        <PanelTitle asHeading={presentation === "page"}>
          {t.thanksTitle}
        </PanelTitle>
        <p className="text-lg leading-relaxed text-foreground/80">{t.thanksBody}</p>
        {amount ? <p className="font-display text-xl font-semibold text-navy">{t.thanksAmount.replace("{amount}", amount)}</p> : null}
      </div>
    );
  }

  return (
    <div data-testid="donate-panel" className="flex flex-col gap-5 py-2">
      <div className="flex flex-col gap-3">
        <PanelTitle asHeading={presentation === "page"}>
          {t.title}
        </PanelTitle>
        <p className="max-w-[60ch] text-lg leading-relaxed text-foreground/80">{t.lead}</p>
        <p className="max-w-[60ch] text-muted">{t.uses}</p>
      </div>

      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          data-testid="donate-paypal"
          onClick={openCheckout}
          disabled={sdk.status !== "ready"}
          aria-describedby="donate-note"
          className={`${buttonVariants({ variant: "accent", size: "cta" })} h-12 w-full px-6 text-base sm:w-auto focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus`}
        >
          <Heart aria-hidden="true" className="fill-current" />
          {sdk.status === "loading" ? t.loading : t.button}
        </button>
        <p id="donate-note" className="text-sm text-muted">
          {sdk.status === "error" ? t.unavailable : t.buttonNote}
        </p>
      </div>

      <a
        href={PAYPAL_DONATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="donate-fallback"
        onClick={() => track({ name: "donate_begin", params: { method: "paypal_link" } })}
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-navy underline underline-offset-4 outline-focus hover:decoration-2 focus:outline-2 focus:outline-offset-2"
      >
        {t.fallback}
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </a>
    </div>
  );
}
