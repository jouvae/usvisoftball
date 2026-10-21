import type { SVGProps } from "react";
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

// Navy footer (home-layout design guide §3.2): swoosh edge → crest · Contact · Explore ·
// Follow → tagline row → copyright. Server Component — contact details and socials come from
// the contact_info singleton (socials guarded at render by safeSocialHref: https + host
// allowlist); any empty field is omitted. Mounted once in the public layout.

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path
        fillRule="evenodd"
        d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path
        fillRule="evenodd"
        d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

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
