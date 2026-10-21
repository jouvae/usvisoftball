import { GoogleAnalytics } from "@next/third-parties/google";
import { GA_MEASUREMENT_ID } from "@/lib/flags";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";

// Public chrome (masthead + footer) around the marketing/news routes. A route
// group `(public)` is path-transparent — URLs and testids are unchanged, so
// slices 01/02/03 stay green. Returns a Fragment (NOT a wrapping <div>) so the
// <main> stays a direct flex child of <body> and its `flex-1` keeps stretching.
// Google Analytics loads on the public site only (never /admin), and only when the build
// set a measurement ID (prod). The tag loads after hydration and GA4 records client-side
// navigations through its history-change tracking.
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <SiteHeader />
      <main data-testid="site-main" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
      {GA_MEASUREMENT_ID ? <GoogleAnalytics gaId={GA_MEASUREMENT_ID} /> : null}
    </>
  );
}
