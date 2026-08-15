import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // Emit a self-contained server bundle (`.next/standalone`) so the Docker/Fly
  // image can run `node server.js` without a full `node_modules` — the standard
  // Fly.io deploy shape. Combined with self-hosted fonts, the build needs no
  // network access.
  output: "standalone",
  // Raise the Server-Action body cap above the app's 2 MB photo limit (+ multipart
  // overhead) so lib/board-photos.ts's own 2 MB check — with its FRIENDLY form error — is
  // the effective boundary. The framework default is 1 MB, which would otherwise reject a
  // legit 1–2 MB headshot with a raw "Body exceeded 1 MB limit" error before validation
  // runs (red-team-interactive Low). Files > ~3 MB still hard-fail at the framework, which
  // is the intended DoS backstop.
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  // Allow next/image to render board headshots from Supabase Storage (0009 bucket
  // `board-photos`). Host is PINNED to this project's exact ref (NOT a `*.supabase.co`
  // wildcard) so the image optimizer can't be used as an open proxy for any other
  // Supabase project's public board-photos bucket (red-team-code Low: optimizer SSRF /
  // bandwidth abuse). The ref is the PUBLIC project id (it ships in NEXT_PUBLIC_SUPABASE_URL
  // to every browser — not a secret), inlined so the build needs no env (the Fly builder
  // has none). If the Supabase project changes, update this to match NEXT_PUBLIC_SUPABASE_URL.
  // Pathname is pinned to the public board-photos object path; SVG stays disallowed
  // (dangerouslyAllowSVG defaults off), so only real raster headshots from that bucket load.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "miiyxrjfvzrcryludqcj.supabase.co",
        pathname: "/storage/v1/object/public/board-photos/**",
      },
    ],
  },
};

export default nextConfig;
