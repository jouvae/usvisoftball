// The public production origin. Hardcoded (not env) so the env-free Fly build resolves the same
// absolute URLs (metadataBase → canonical + hreflang alternates) as production. The custom
// domain fronts the Fly app `usvi-softball` (fly.toml); canonicals must use it, not *.fly.dev,
// or search engines split ranking between the two hosts.
export const SITE_URL = "https://usvisoftball.org";
