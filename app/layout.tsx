import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "USVI Softball Federation",
  description:
    "Official home of the U.S. Virgin Islands Softball Federation — news, teams, events, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
