export type ArticleBodyProps = {
  body: string;
  className?: string;
};

// The article body (slice-03 §3.4). Server Component. Rendered as PLAIN,
// React-escaped prose — split on blank lines into <p> elements — NEVER via
// `dangerouslySetInnerHTML`, which would be a stored-XSS hole for
// editor/AI-authored input. Rich text is a later slice.
export function ArticleBody({ body, className = "" }: ArticleBodyProps) {
  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return (
    <div
      data-testid="article-body"
      className={`flex flex-col gap-4 text-lg leading-relaxed text-foreground ${className}`}
    >
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
