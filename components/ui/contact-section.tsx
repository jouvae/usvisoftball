import { safeSocialHref, type ContactInfo } from "@/lib/contact";

// The public Contact block on /about (about-e2e-009). Server Component — no interactivity.
// Each field is optional: an empty value is omitted (real empty-state branches). Email is a
// mailto:, phone a tel: (digits only in the href), social links open in a new tab with
// rel="noopener noreferrer". All values are rendered as text/attributes (React-escaped);
// the social hrefs were https-host-validated at the write boundary (lib/contact).
export function ContactSection({
  contact,
  testId = "about-contact",
}: {
  contact: ContactInfo;
  testId?: string;
}) {
  const { email, phone, address } = contact;
  const telHref = `tel:${phone.replace(/[^\d+]/g, "")}`;
  // Re-assert the https + host allowlist at RENDER time — never emit a stored value that
  // slipped past the write-path validator as a live <a href> (defense-in-depth).
  const facebookUrl = safeSocialHref(contact.facebookUrl, "facebook");
  const instagramUrl = safeSocialHref(contact.instagramUrl, "instagram");

  // Nothing set → render nothing (the /about caller also guards, but be defensive).
  if (!email && !phone && !address && !facebookUrl && !instagramUrl) return null;

  return (
    <section data-testid={testId} className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-brand">
        Contact
      </h2>
      <dl className="flex flex-col gap-3 text-foreground">
        {email ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm font-semibold uppercase tracking-wide text-muted">
              Email
            </dt>
            <dd>
              <a
                data-testid="contact-email"
                href={`mailto:${email}`}
                className="text-brand underline-offset-4 hover:underline"
              >
                {email}
              </a>
            </dd>
          </div>
        ) : null}

        {phone ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm font-semibold uppercase tracking-wide text-muted">
              Phone
            </dt>
            <dd>
              <a
                data-testid="contact-phone"
                href={telHref}
                className="text-brand underline-offset-4 hover:underline"
              >
                {phone}
              </a>
            </dd>
          </div>
        ) : null}

        {address ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm font-semibold uppercase tracking-wide text-muted">
              Address
            </dt>
            <dd data-testid="contact-address" className="whitespace-pre-line">
              {address}
            </dd>
          </div>
        ) : null}

        {facebookUrl || instagramUrl ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm font-semibold uppercase tracking-wide text-muted">
              Follow us
            </dt>
            <dd className="flex gap-4">
              {facebookUrl ? (
                <a
                  data-testid="contact-facebook"
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline-offset-4 hover:underline"
                >
                  Facebook
                </a>
              ) : null}
              {instagramUrl ? (
                <a
                  data-testid="contact-instagram"
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline-offset-4 hover:underline"
                >
                  Instagram
                </a>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
