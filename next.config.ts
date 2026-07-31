import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // Emit a self-contained server bundle (`.next/standalone`) so the Docker/Fly
  // image can run `node server.js` without a full `node_modules` — the standard
  // Fly.io deploy shape. Combined with self-hosted fonts, the build needs no
  // network access.
  output: "standalone",
};

export default nextConfig;
