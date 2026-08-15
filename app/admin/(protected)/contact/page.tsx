import { requireRole } from "@/lib/roles";
import { getContactInfo } from "@/lib/contact";
import { ContactEditForm } from "@/components/client/contact-edit-form";

// The contact admin screen (about-e2e-010). Editor-only: requireRole('editor') runs as the
// FIRST await (redirects a non-editor to /admin), before any child renders. force-dynamic
// so the form always reflects the live singleton after a save revalidation.
export const dynamic = "force-dynamic";

export default async function ContactAdminPage() {
  await requireRole("editor");
  const contact = await getContactInfo();

  return (
    <section data-testid="contact-admin" className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-semibold text-brand">
        Contact information
      </h1>
      <p className="max-w-2xl text-sm text-muted">
        Shown in the Contact section on the public About page. Social links must
        be full https:// Facebook or Instagram URLs.
      </p>
      <ContactEditForm contact={contact} />
    </section>
  );
}
