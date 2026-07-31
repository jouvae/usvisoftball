import Image from "next/image";

export type ArticleHeroProps = {
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  className?: string;
};

// The above-the-fold cover image (slice-03 §3.3). Server Component — nothing
// here is interactive. Renders `null` when there is no cover image, so the page
// has no empty hero box. `fill` needs a `position: relative` parent
// (image.md §fill). The `article-hero` testid is pinned to the <Image> element
// itself — next/image forwards data-testid to the underlying <img> that carries
// `alt`, so the alt assertion (§9.2) targets the right node.
export function ArticleHero({
  coverImageUrl,
  coverImageAlt,
  className = "",
}: ArticleHeroProps) {
  if (!coverImageUrl) return null;

  return (
    <div className={`relative aspect-[16/9] w-full bg-surface ${className}`}>
      <Image
        data-testid="article-hero"
        src={coverImageUrl}
        alt={coverImageAlt ?? ""}
        fill
        priority
        sizes="(min-width: 768px) 768px, 100vw"
        className="object-cover"
      />
    </div>
  );
}
