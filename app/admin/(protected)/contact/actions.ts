"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateContactInfo, ContactUrlError } from "@/lib/contact";

// Feature softball/about — Slice 4 admin contact editor (about-e2e-010). Like every board
// Server Action, this is an independently-callable POST endpoint, so it AUTHENTICATES +
// AUTHORIZES itself (requireRole('editor')) and writes through the editor SESSION client —
// the 0010 RLS is the real boundary, no admin/service fallback. A bad social URL surfaces
// as ContactUrlError → friendly form error; a 0-row update (non-editor) is PGRST116.

export type ContactActionState = { error: string } | undefined;

function pgErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

export async function updateContactAction(
  _prevState: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  await requireRole("editor");

  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const facebookUrl = String(formData.get("facebookUrl") ?? "").trim();
  const instagramUrl = String(formData.get("instagramUrl") ?? "").trim();

  const supabase = await createSupabaseServerClient();
  try {
    await updateContactInfo(
      { email, phone, address, facebookUrl, instagramUrl },
      supabase,
    );
  } catch (err) {
    if (err instanceof ContactUrlError) {
      return { error: err.message };
    }
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not save contact info. Please try again." };
    }
    throw err;
  }

  revalidatePath("/about");
  revalidatePath("/admin/contact");
  return undefined;
}
