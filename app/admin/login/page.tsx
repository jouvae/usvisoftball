import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/client/admin-login-form";

export const metadata: Metadata = {
  title: "Admin sign-in — USVI Softball Federation",
};

// The ungated login route: it inherits only the slim root layout (no public
// chrome, no admin chrome) and renders its own <main>. It sits OUTSIDE
// `(protected)`, so the guard cannot redirect-loop it.
export default function AdminLoginPage() {
  return (
    <main
      data-testid="admin-login-main"
      className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-16"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8">
        <h1 className="font-display text-2xl font-semibold text-brand">
          Admin sign-in
        </h1>
        <p className="mt-1 text-sm text-muted">
          Sign in to manage the Federation site.
        </p>
        <AdminLoginForm className="mt-6" />
      </div>
    </main>
  );
}
