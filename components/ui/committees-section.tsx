import type { Committee } from "@/lib/committees";

// The public Committees block on /about (about-web-011). Server Component — no
// interactivity. Each committee shows its name + description and an ordered member list
// (name — role). Photos exist in the model (committee_members.photo_url) but this render
// slice is text-only; the CRUD slice wires uploads. Empty committee list → render nothing.
export function CommitteesSection({
  committees,
  testId = "about-committees",
}: {
  committees: Committee[];
  testId?: string;
}) {
  if (committees.length === 0) return null;

  return (
    <section data-testid={testId} className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-brand">
        Committees
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {committees.map((c) => (
          <div
            key={c.id}
            data-testid="committee"
            className="flex flex-col gap-3 rounded-lg border border-border bg-background p-5"
          >
            <h3
              data-testid="committee-name"
              className="font-display text-xl font-bold leading-tight tracking-tight text-brand"
            >
              {c.name}
            </h3>
            {c.description ? (
              <p
                data-testid="committee-description"
                className="text-sm text-foreground"
              >
                {c.description}
              </p>
            ) : null}
            {c.members.length > 0 ? (
              <ul data-testid="committee-roster" className="flex flex-col gap-1">
                {c.members.map((m) => (
                  <li
                    key={m.id}
                    data-testid="committee-member"
                    className="text-sm text-foreground"
                  >
                    <span
                      data-testid="committee-member-name"
                      className="font-semibold"
                    >
                      {m.name}
                    </span>
                    {m.role ? (
                      <span
                        data-testid="committee-member-role"
                        className="text-muted"
                      >
                        {" "}
                        — {m.role}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
