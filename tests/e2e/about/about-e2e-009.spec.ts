/*
---
id: about-e2e-009
name: "about-e2e-009: Public Contact section renders the federation contact info"
feature: softball/about
stack: web
priority: P0
group: A
references:
  - app/(public)/about/page.tsx (getContactInfo → ContactSection)
  - components/ui/contact-section.tsx (mailto:/tel: + rel=noopener social links)
  - lib/contact.ts (getContactInfo via the RLS publishable client)
  - supabase/migrations/0010_contact_info.sql (public SELECT policy; seeded singleton)
---

## Given
The `contact_info` singleton (id=true) holds the federation's current contact
fields, readable by anyone through the public SELECT RLS policy.

## When
An anonymous visitor opens /about.

## Then
The Contact section (`about-contact`) renders the CURRENT email as a `mailto:`,
the phone as a `tel:` (digits only in the href), the address text, and the
Facebook/Instagram links as https hrefs with rel containing "noopener",
target=_blank. Empty fields are omitted. Every assertion is made against the
live singleton read out-of-band with the service key — the test asserts the page
reflects the DB, not a hard-coded value.

Read-only: this spec never mutates the singleton, so it needs no teardown and is
safe to run at both viewports.
*/

import { test, expect } from "@playwright/test";
import { createAdminClient } from "@/lib/supabase/admin";

type ContactRow = {
  email: string;
  phone: string;
  address: string;
  facebook_url: string;
  instagram_url: string;
};

async function readContact(): Promise<ContactRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contact_info")
    .select("email,phone,address,facebook_url,instagram_url")
    .eq("id", true)
    .single();
  if (error) throw error;
  return data as ContactRow;
}

test.describe("about-e2e-009 — public Contact section reflects the live singleton", () => {
  test("anon /about renders email/phone/address/social from the current contact_info", async ({
    page,
  }) => {
    // GIVEN: the live singleton values (out-of-band service read — the source of truth).
    const contact = await readContact();

    // WHEN: an anonymous visitor opens /about.
    await page.goto("/about");

    // THEN: the Contact section renders and reflects the DB.
    const section = page.getByTestId("about-contact");
    await expect(section).toBeVisible();

    if (contact.email) {
      const emailLink = page.getByTestId("contact-email");
      await expect(emailLink).toHaveAttribute("href", `mailto:${contact.email}`);
      await expect(emailLink).toContainText(contact.email);
    } else {
      await expect(page.getByTestId("contact-email")).toHaveCount(0);
    }

    if (contact.phone) {
      const telHref = `tel:${contact.phone.replace(/[^\d+]/g, "")}`;
      const phoneLink = page.getByTestId("contact-phone");
      await expect(phoneLink).toHaveAttribute("href", telHref);
      await expect(phoneLink).toContainText(contact.phone);
    } else {
      await expect(page.getByTestId("contact-phone")).toHaveCount(0);
    }

    if (contact.address) {
      await expect(page.getByTestId("contact-address")).toContainText(
        contact.address,
      );
    } else {
      await expect(page.getByTestId("contact-address")).toHaveCount(0);
    }

    if (contact.facebook_url) {
      const fb = page.getByTestId("contact-facebook");
      await expect(fb).toHaveAttribute("href", contact.facebook_url);
      expect(contact.facebook_url.startsWith("https://")).toBe(true);
      await expect(fb).toHaveAttribute("rel", /noopener/);
      await expect(fb).toHaveAttribute("target", "_blank");
    } else {
      await expect(page.getByTestId("contact-facebook")).toHaveCount(0);
    }

    if (contact.instagram_url) {
      const ig = page.getByTestId("contact-instagram");
      await expect(ig).toHaveAttribute("href", contact.instagram_url);
      expect(contact.instagram_url.startsWith("https://")).toBe(true);
      await expect(ig).toHaveAttribute("rel", /noopener/);
      await expect(ig).toHaveAttribute("target", "_blank");
    } else {
      await expect(page.getByTestId("contact-instagram")).toHaveCount(0);
    }
  });
});
