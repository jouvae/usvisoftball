import Image from "next/image";
import type { GalleryImage } from "@/lib/articles";

export type ArticleGalleryProps = {
  images: GalleryImage[];
  className?: string;
};

// The article gallery (slice-03 §3.5). Server Component. Renders `null` when the
// gallery is empty, so an empty gallery produces NO <section> at all (the
// `article-gallery` testid is simply absent — the tester asserts count 0). Images
// render in array order via next/image with local `/public` paths. Each item is a
// `relative` ratio wrapper (required for `fill`; image.md §fill); gallery images
// are below the fold, so no `priority` (lazy-load).
export function ArticleGallery({ images, className = "" }: ArticleGalleryProps) {
  if (images.length === 0) return null;

  return (
    <section
      data-testid="article-gallery"
      aria-label="Photo gallery"
      className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      {images.map((image, index) => (
        <div
          key={index}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface"
        >
          <Image
            data-testid="article-gallery-image"
            src={image.url}
            alt={image.alt}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ))}
    </section>
  );
}
