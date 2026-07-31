import { requireUser } from "@/lib/auth";

// Layer B — THE security boundary. `requireUser()` runs as the FIRST await, before
// any child renders: an anon request is redirected (307) to `/admin/login` and the
// dashboard page never executes, so no admin data is serialized.
//
// NEVER add `loading.tsx`/Suspense above this guard — a streamed shell would flush
// a 200 and silently downgrade the gate (the slice-03 trap).
export default async function AdminProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();

  return (
    <main
      data-testid="admin-main"
      className="flex flex-1 flex-col bg-background px-4 py-8"
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </main>
  );
}
