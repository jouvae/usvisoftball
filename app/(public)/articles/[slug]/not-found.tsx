import Link from "next/link";

// The branded 404 for a missing/hidden article (slice-03 §3.2). Server Component.
// not-found.js components accept NO props, so this UI structurally cannot render a
// draft's title/body — that is what makes "the draft's title never leaks into the
// 404" true by construction, not by coincidence. Renders inside the root layout's
// <main>, so it emits NO <main> of its own; its heading is the segment's sole <h1>.
export default function ArticleNotFound() {
  return (
    <div
      data-testid="article-not-found"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-4 py-24"
    >
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-brand">
        Article not found
      </h1>
      <p className="text-muted">
        We couldn&apos;t find that story. It may have been moved or is not yet
        published.
      </p>
      <Link
        href="/articles"
        className="font-display font-semibold text-brand hover:text-brand-hover"
      >
        Back to news
      </Link>
    </div>
  );
}
