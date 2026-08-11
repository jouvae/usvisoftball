import { notFound } from "next/navigation";
import Link from "next/link";
import { listBoardForTerm } from "@/lib/board";
import { BoardRoster } from "@/components/ui/board-roster";

// DELIVER (Node 1): read-only archived roster for one term, from the REAL Supabase read
// via lib/board (RLS-enforced publishable client). `params` is a Promise in Next 16 and
// MUST be awaited (03-layouts-and-pages.md §"Creating a dynamic segment").
export default async function AboutTermPage({
  params,
}: PageProps<"/about/[term]">) {
  const { term } = await params;

  const found = await listBoardForTerm(term);
  if (!found) notFound();

  // Roster already ordered (sort_order, name) by the read contract.
  const members = found.members;

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <Link
          href="/about"
          className="w-fit text-sm font-semibold text-muted underline-offset-4 hover:text-brand hover:underline"
        >
          ← About
        </Link>
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-brand">
          Board {found.term.label}
        </h1>
      </div>
      <BoardRoster testId="about-term-roster" members={members} />
    </section>
  );
}
