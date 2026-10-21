import Link from "next/link";
import { getMission, listCurrentBoard, listArchivedTerms } from "@/lib/board";
import { getContactInfo } from "@/lib/contact";
import { listCommittees } from "@/lib/committees";
import { listPublishedArticles } from "@/lib/articles";
import { BoardGrid } from "@/components/client/board-grid";
import { AccentRule } from "@/components/ui/motifs/accent-rule";
import { ArticleCard } from "@/components/ui/article-card";
import { ContactSection } from "@/components/ui/contact-section";
import { CommitteesSection } from "@/components/ui/committees-section";
import { FaqSection } from "@/components/client/faq-section";

// About page — the provided Tailwind UI "About" template's section rhythm (hero → mission
// + facts → feature image → team → articles), wired to the REAL Supabase reads and the
// site's own sections. The template's placeholder-only sections (fake "$ stats", "Our
// values" lorem, the "innovative teams" logo cloud, the lorem blog) are replaced with real
// federation content: the mission, a real facts strip, the board (grid + profile modal),
// committees, the latest articles, an FAQ, and contact.
export const dynamic = "force-dynamic";

// PLACEHOLDER imagery — swap for real federation photos. Plain <img>: external placeholders,
// not Storage assets, so outside next/image's pinned remotePatterns.
const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&h=528&q=80",
  "https://images.unsplash.com/photo-1485217988980-11786ced9454?auto=format&fit=crop&h=528&q=80",
  "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&crop=focalpoint&fp-x=.4&w=396&h=528&q=80",
  "https://images.unsplash.com/photo-1670272504528-790c24957dda?auto=format&fit=crop&crop=left&w=400&h=528&q=80",
  "https://images.unsplash.com/photo-1670272505284-8faba1c31f7d?auto=format&fit=crop&h=528&q=80",
];
const FEATURE_IMAGE =
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=2832&q=80";

const ISLANDS = ["St. Thomas", "St. John", "St. Croix"];

export default async function AboutPage() {
  const [mission, currentBoard, archivedTerms, contact, committees, articles] =
    await Promise.all([
      getMission(),
      listCurrentBoard(),
      listArchivedTerms(),
      getContactInfo(),
      listCommittees(),
      listPublishedArticles(),
    ]);

  const currentMembers = currentBoard?.members ?? [];
  const latestArticles = articles.slice(0, 3);

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero — template decorative hero + real mission title, staggered gallery. `isolate`
          scopes the -z-10 decoration (the template relied on a <main class="isolate">). */}
      <section
        data-testid="about-mission"
        className="relative isolate overflow-hidden bg-surface"
      >
        <svg
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-[40rem] w-full mask-[radial-gradient(32rem_32rem_at_center,white,transparent)] stroke-border"
        >
          <defs>
            <pattern
              x="50%"
              y={-1}
              id="about-hero-grid"
              width={200}
              height={200}
              patternUnits="userSpaceOnUse"
            >
              <path d="M.5 200V.5H200" fill="none" />
            </pattern>
          </defs>
          <rect fill="url(#about-hero-grid)" width="100%" height="100%" strokeWidth={0} />
        </svg>
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 left-1/2 -z-10 -ml-24 transform-gpu overflow-hidden blur-3xl lg:ml-24 xl:ml-48"
        >
          <div
            style={{
              clipPath:
                "polygon(63.1% 29.5%, 100% 17.1%, 76.6% 3%, 48.4% 0%, 44.6% 4.7%, 54.5% 25.3%, 59.8% 49%, 55.2% 57.8%, 44.4% 57.2%, 27.8% 47.9%, 35.1% 81.5%, 0% 97.7%, 39.2% 100%, 35.2% 81.4%, 97.2% 52.8%, 63.1% 29.5%)",
            }}
            className="aspect-[801/1036] w-[50rem] bg-gradient-to-tr from-brand to-accent opacity-20"
          />
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-20 pb-24 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-2xl gap-x-14 lg:mx-0 lg:flex lg:max-w-none lg:items-center">
            <div className="relative w-full lg:max-w-xl lg:shrink-0">
              <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-navy">
                The Federation
              </p>
              <h1 className="mt-4 font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight text-navy sm:text-6xl">
                {mission?.title ?? "About"}
              </h1>
              {mission ? (
                <p className="mt-6 text-lg text-foreground">{mission.body}</p>
              ) : null}
            </div>
            <div className="mt-14 flex justify-end gap-6 sm:-mt-12 sm:justify-start sm:pl-20 lg:mt-0 lg:pl-0">
              <div className="ml-auto w-40 flex-none space-y-6 pt-24 sm:ml-0 sm:pt-52 lg:order-last lg:pt-24">
                <GalleryImage src={HERO_IMAGES[0]} />
              </div>
              <div className="mr-auto w-40 flex-none space-y-6 sm:mr-0 sm:pt-36 lg:pt-24">
                <GalleryImage src={HERO_IMAGES[1]} />
                <GalleryImage src={HERO_IMAGES[2]} />
              </div>
              <div className="w-40 flex-none space-y-6 pt-24 sm:pt-0">
                <GalleryImage src={HERO_IMAGES[3]} />
                <GalleryImage src={HERO_IMAGES[4]} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real facts strip (replaces the template's fabricated stats). */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 lg:px-8">
        <dl className="grid grid-cols-1 gap-8 border-y border-border py-8 sm:grid-cols-3">
          <div className="flex flex-col-reverse gap-2">
            <dt className="text-sm text-muted">Islands served</dt>
            <dd className="font-display text-4xl font-bold text-navy">3</dd>
          </div>
          <div className="flex flex-col-reverse gap-2">
            <dt className="text-sm text-muted">Home of softball in the</dt>
            <dd className="font-display text-4xl font-bold text-navy">
              U.S. Virgin Islands
            </dd>
          </div>
          <div className="flex flex-col-reverse gap-2">
            <dt className="text-sm text-muted">{ISLANDS.join(" · ")}</dt>
            <dd className="font-display text-4xl font-bold text-navy">
              One Federation
            </dd>
          </div>
        </dl>
      </section>

      {/* Feature image (placeholder — swap for a real federation photo). */}
      <div className="mt-16 sm:mt-24 xl:mx-auto xl:max-w-7xl xl:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FEATURE_IMAGE}
          alt=""
          className="aspect-[5/2] w-full object-cover outline outline-1 -outline-offset-1 outline-black/5 xl:rounded-3xl"
        />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-16 lg:px-8">
        {currentBoard ? (
          // Team section — the "Meet our leadership" layout from
          // components/samples/board-member-section.tsx, in the site's type and colours.
          <section
            data-testid="about-board"
            aria-labelledby="about-board-heading"
            className="flex flex-col gap-14 py-8 sm:gap-16"
          >
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
              <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Board of Directors · {currentBoard.term.label}
              </p>
              <h2
                id="about-board-heading"
                className="font-display text-4xl font-bold uppercase tracking-tight text-balance text-navy sm:text-5xl"
              >
                Meet our leadership
              </h2>
              <AccentRule />
              <p className="text-lg text-muted">
                The volunteer board that leads softball across St. Thomas, St. John, and St.
                Croix, from youth programs to the national teams.
              </p>
            </div>
            <BoardGrid members={currentMembers} />
          </section>
        ) : null}

        {archivedTerms.length > 0 ? (
          <section data-testid="about-archive" className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-navy">
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

        {committees.length > 0 ? (
          <CommitteesSection committees={committees} />
        ) : null}

        {/* Articles — the template's blog section, wired to the real published feed. */}
        {latestArticles.length > 0 ? (
          <section className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-navy">
                Latest from the Federation
              </h2>
              <Link
                href="/articles"
                className="w-fit font-display font-semibold text-brand underline outline-focus hover:text-brand-hover focus:outline-2"
              >
                View all articles
              </Link>
            </div>
            <ul
              role="list"
              className="grid auto-rows-fr grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
            >
              {latestArticles.map((article, i) => (
                <ArticleCard key={article.id} article={article} priority={i === 0} />
              ))}
            </ul>
          </section>
        ) : null}

        <FaqSection />

        {contact ? <ContactSection contact={contact} /> : null}
      </div>
    </div>
  );
}

// One staggered-gallery tile (placeholder art). Plain <img> with a soft rounded frame.
function GalleryImage({ src }: { src: string }) {
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="aspect-[2/3] w-full rounded-xl bg-slate-900/5 object-cover shadow-lg"
      />
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-black/10" />
    </div>
  );
}
