"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = { error: string } | undefined;

// Server-Action sign-in — "a secure environment for handling authentication"
// (authentication.md L36). Validates, drives the REAL Supabase
// `signInWithPassword` (which sets the session cookie via the server client's
// `setAll`), and on success redirects to `/admin`.
//
// `redirect('/admin')` MUST stay OUTSIDE any try/catch: it works by THROWING a
// NEXT_REDIRECT error that Next catches to navigate. A catch around it would
// swallow that and strand the user on the login page.
export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Generic message — no user-enumeration.
    return { error: "Invalid email or password." };
  }

  redirect("/admin");
}
