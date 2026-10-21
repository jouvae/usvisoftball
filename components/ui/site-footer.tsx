import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { getContactInfo, safeSocialHref } from "@/lib/contact";
import {
  EVENTS_ENABLED,
  PAYPAL_DONATE_URL,
  SHOP_ENABLED,
  TEAMS_ENABLED,
} from "@/lib/flags";
import { AccentRule } from "@/components/ui/motifs/accent-rule";
import { FooterSwoosh } from "@/components/ui/motifs/footer-swoosh";
import { IslandSilhouettes } from "@/components/ui/motifs/island-silhouettes";
import { FacebookIcon, InstagramIcon } from "@/components/ui/social-icons";

// Navy footer (home-layout design guide §3.2): swoosh edge → crest · Contact · Explore ·
// Follow → tagline row → copyright. Server Component — contact details and socials come from
// the contact_info singleton (socials guarded at render by safeSocialHref: https + host
// allowlist); any empty field is omitted. Mounted once in the public layout.

export async function SiteFooter({ className = "" }: { className?: string }) {
  const year = new Date().getFullYear();
  const contact = await getContactInfo().catch(() => null);

  // Mirrors the primary nav (same flags), so the footer doubles as a sitemap.
  const links = [
    ...(TEAMS_ENABLED ? [{ name: "Teams", href: "/teams" }] : []),
    ...(EVENTS_ENABLED ? [{ name: "Events", href: "/events" }] : []),
    { name: "News", href: "/articles" },
    { name: "Get Involved", href: "/get-involved" },
    ...(SHOP_ENABLED ? [{ name: "Shop", href: "/shop" }] : []),
    { name: "About", href: "/about" },
  ];

  const socials = [
    {
      name: "Facebook",
      href: contact ? safeSocialHref(contact.facebookUrl, "facebook") : "",
      Icon: FacebookIcon,
    },
    {
      name: "Instagram",
      href: contact ? safeSocialHref(contact.instagramUrl, "instagram") : "",
      Icon: InstagramIcon,
    },
  ].filter((s) => s.href !== "");

  const linkClass =
    "outline-accent hover:text-accent focus:outline-2 focus:outline-offset-2";
  const eyebrowClass =
    "font-display text-sm font-semibold uppercase tracking-[0.2em] text-navy-foreground";

  return (
    <footer data-testid="site-footer" className={`mt-auto ${className}`}>
      <FooterSwoosh className="-mb-px" />
      <div className="relative overflow-hidden bg-navy text-navy-muted">
        <IslandSilhouettes className="pointer-events-none absolute right-0 bottom-16 hidden w-[26rem] fill-white/5 lg:block" />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-12 sm:px-6 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr_1fr] lg:gap-12">
          <Link
            href="/"
            className="w-fit rounded-lg sm:col-span-2 lg:col-span-1 outline-accent focus:outline-2 focus:outline-offset-4"
          >
            <span className="sr-only">USVI Softball Federation — home</span>
            <Image
              src="/brand/crest.png"
              alt=""
              width={256}
              height={240}
              className="h-28 w-auto"
            />
          </Link>

          {contact && (contact.email || contact.address || contact.phone) ? (
            <div data-testid="footer-contact" className="flex flex-col gap-4">
              <h2 className={eyebrowClass}>Contact</h2>
              <ul className="flex flex-col gap-3 text-sm">
                {contact.email ? (
                  <li className="flex items-start gap-3">
                    <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
                    <a href={`mailto:${contact.email}`} className={linkClass}>
                      {contact.email}
                    </a>
                  </li>
                ) : null}
                {contact.address ? (
                  <li className="flex items-start gap-3">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>{contact.address}</span>
                  </li>
                ) : null}
                {contact.phone ? (
                  <li className="flex items-start gap-3">
                    <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
                    <a
                      href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                      className={linkClass}
                    >
                      {contact.phone}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <nav aria-label="Footer" className="flex flex-col gap-4">
            <h2 className={eyebrowClass}>Explore</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.name}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={PAYPAL_DONATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Support the Federation
                  <span className="sr-only"> (opens PayPal)</span>
                </a>
              </li>
            </ul>
          </nav>

          {socials.length > 0 ? (
            <div className="flex flex-col gap-4">
              <h2 className={eyebrowClass}>Follow</h2>
              <ul className="flex flex-col gap-3 text-sm">
                {socials.map(({ name, href, Icon }) => (
                  <li key={name}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-3 ${linkClass}`}
                    >
                      <Icon aria-hidden="true" className="size-5 text-accent" />
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col gap-3 px-4 pb-10 sm:px-6">
          <AccentRule />
          <p className="font-display text-2xl font-medium tracking-wide text-navy-foreground sm:text-3xl">
            From the Virgin Islands to the World.
          </p>
        </div>

        <div className="relative border-t border-white/10">
          <p className="mx-auto max-w-6xl px-4 py-6 text-sm sm:px-6">
            &copy; {year} U.S. Virgin Islands Softball Federation. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
