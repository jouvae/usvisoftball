"use client";

import { useActionState } from "react";
import type { ContactInfo } from "@/lib/contact";
import {
  updateContactAction,
  type ContactActionState,
} from "@/app/admin/(protected)/contact/actions";

// The contact-editor island (about-e2e-010). `useActionState(updateContactAction)` tracks
// pending + surfaces the returned error; on success the action revalidates, so /about and
// this screen re-render with the new values. `import type { ContactInfo }` is erased at
// compile, so this client module never drags `server-only` (lib/contact) into the bundle.
// Navy-on-white submit per DESIGN.md; `dangerouslySetInnerHTML` stays banned.
export function ContactEditForm({ contact }: { contact: ContactInfo | null }) {
  const [state, formAction, pending] = useActionState<
    ContactActionState,
    FormData
  >(updateContactAction, undefined);

  const field =
    "rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2";

  return (
    <form
      action={formAction}
      data-testid="contact-form"
      className="flex max-w-xl flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Email
        <input
          type="email"
          name="email"
          defaultValue={contact?.email ?? ""}
          data-testid="contact-email-input"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Phone
        <input
          type="text"
          name="phone"
          defaultValue={contact?.phone ?? ""}
          data-testid="contact-phone-input"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Mailing address
        <textarea
          name="address"
          rows={3}
          defaultValue={contact?.address ?? ""}
          data-testid="contact-address-input"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Facebook URL
        <input
          type="url"
          name="facebookUrl"
          placeholder="https://www.facebook.com/…"
          defaultValue={contact?.facebookUrl ?? ""}
          data-testid="contact-facebook-input"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Instagram URL
        <input
          type="url"
          name="instagramUrl"
          placeholder="https://www.instagram.com/…"
          defaultValue={contact?.instagramUrl ?? ""}
          data-testid="contact-instagram-input"
          className={field}
        />
      </label>

      {state?.error ? (
        <p data-testid="contact-error" className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid="contact-save"
        className="w-fit rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save contact info"}
      </button>
    </form>
  );
}
