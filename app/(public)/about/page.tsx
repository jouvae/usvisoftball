import Link from "next/link";
import { getMission, listCurrentBoard, listArchivedTerms } from "@/lib/board";
import { BoardRoster } from "@/components/ui/board-roster";

// DELIVER (Node 1): renders from the REAL Supabase reads via lib/board (RLS-enforced
// publishable client). Empty-state branches are now real paths (no mission → omit;
// no current term → roster empty state; no archived terms → omit archive).
// Server Component; roots at <section>s — the layout owns the sole <main> landmark.

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const [mission, currentBoard, archivedTerms] = await Promise.all([
    getMission(),
    listCurrentBoard(),
    listArchivedTerms(),
  ]);

  // Roster already ordered (sort_order, name) by the read contract.
  const currentMembers = currentBoard?.members ?? [];

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-12">
      {mission ? (
        <section data-testid="about-mission" className="flex flex-col gap-4">
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-brand">
            {mission.title ?? "About"}
          </h1>
          <p className="max-w-3xl text-lg text-foreground">{mission.body}</p>
        </section>
      ) : null}

      {currentBoard ? (
        <section className="flex flex-col gap-6">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-brand">
            Board of Directors
            <span className="ml-2 text-muted">{currentBoard.term.label}</span>
          </h2>
          <BoardRoster testId="about-board-roster" members={currentMembers} />
        </section>
      ) : null}

      {archivedTerms.length > 0 ? (
        <section data-testid="about-archive" className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-brand">
            Past Boards
          </h2>
          <ul role="list" className="flex flex-col gap-2">
            {archivedTerms.map((t) => (
              <li key={t.slug}>
                <Link
                  data-testid="about-archive-term"
                  href={`/about/${t.slug}`}
                  className="font-display text-lg font-semibold text-brand underline-offset-4 hover:text-brand-hover hover:underline"
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
