"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/admin/login/actions";

// The interactive island: `useActionState(signIn)` wires the form to the Server
// Action, tracks the pending state, and surfaces the returned error. Gold is NOT
// used here (no CTA) — the primary button is navy-on-white per DESIGN.md.
export function AdminLoginForm({ className = "" }: { className?: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    signIn,
    undefined,
  );

  return (
    <form
      action={formAction}
      data-testid="admin-login-form"
      className={`flex flex-col gap-4 ${className}`}
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          data-testid="admin-login-email"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          data-testid="admin-login-password"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2"
        />
      </label>

      {state?.error ? (
        <p data-testid="admin-login-error" className="text-sm text-muted">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid="admin-login-submit"
        className="rounded-md bg-brand px-4 py-2 font-medium text-header-foreground outline-focus hover:bg-brand-hover focus:outline-2 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
