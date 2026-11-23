// Feature softball/donate — GA4 custom events, client-safe. A no-op when the GA tag isn't on the
// page (dev, e2e, local builds, ad blockers), so callers never need to check. Never put personal
// data (names, emails) in params.
type GtagParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (command: "event", name: string, params?: GtagParams) => void;
  }
}

export type SupportCtaLocation = "nav" | "footer" | "home_involved" | "involved_page" | "article";

export type AnalyticsEvent =
  | { name: "support_cta_click"; params: { cta_location: SupportCtaLocation } }
  | { name: "donate_view"; params: { presentation: "modal" | "drawer" | "page" } }
  | { name: "donate_begin"; params: { method: "paypal_window" | "paypal_link" } }
  | {
      name: "donate_complete";
      params: { value?: number; currency?: string; transaction_id?: string };
    }
  | { name: "donate_error"; params: { reason: "sdk_unavailable" } };

export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", event.name, event.params);
}
