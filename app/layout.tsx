import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SITE_URL } from "@/lib/site";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";

// SELF-HOSTED fonts — `next build` performs NO build-time network fetch (a
// network-less CI / Fly build would fail with `next/font/google`). Geist ships its
// woff2 in the `geist` package (`GeistSans`/`GeistMono`, self-hosted via
// next/font/local), exposing the EXACT CSS variables the app already uses
// (`--font-geist-sans` / `--font-geist-mono`). Oswald is vendored as a variable
// woff2 under `app/fonts/` and loaded with next/font/local, keeping the
// `--font-oswald` variable (→ `--font-display` in globals.css) identical — nothing
// visually changes.
const oswald = localFont({
  src: "./fonts/oswald-variable.woff2",
  variable: "--font-oswald",
  weight: "200 700",
  display: "swap",
});

// metadataBase makes relative metadata URLs (canonical, hreflang alternates) absolute against
// the production origin — a constant, so the env-free build resolves the same URLs.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "USVI Softball Federation",
  description:
    "Official home of the U.S. Virgin Islands Softball Federation — news, teams, events, and more.",
};

// `lang` follows the request locale (proxy.ts → x-locale), and the LocaleProvider hands it to
// Client Components (nav, switcher). Reading the header makes every route request-time rendered.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={cn(
        "h-full",
        "antialiased",
        GeistSans.variable,
        GeistMono.variable,
        oswald.variable,
        "font-sans",
      )}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
