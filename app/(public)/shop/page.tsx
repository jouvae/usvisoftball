import { notFound } from "next/navigation";
import { SHOP_ENABLED } from "@/lib/flags";

// The Shop is a REDESIGN PLACEHOLDER (mock items, no commerce). Dormant for launch: when
// NEXT_PUBLIC_SHOP_ENABLED is not "true" the route 404s and the nav link is hidden. Flip
// the flag once real products/checkout land. No DB read — static mock content.
export const metadata = { title: "Shop" };

// Placeholder federation merch. Prices/images are mock; replace when the store is real.
const products = [
  {
    id: "cap",
    name: "Federation Cap",
    price: "$25",
    availability: "Navy / White",
    imageSrc:
      "https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-07-product-01.jpg",
    imageAlt: "Placeholder product image.",
  },
  {
    id: "jersey",
    name: "Home Jersey",
    price: "$60",
    availability: "Sizes S–XXL",
    imageSrc:
      "https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-07-product-02.jpg",
    imageAlt: "Placeholder product image.",
  },
  {
    id: "hoodie",
    name: "Territory Hoodie",
    price: "$55",
    availability: "Blue",
    imageSrc:
      "https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-07-product-03.jpg",
    imageAlt: "Placeholder product image.",
  },
  {
    id: "tee",
    name: "Classic Tee",
    price: "$25",
    availability: "White / Blue",
    imageSrc:
      "https://tailwindcss.com/plus-assets/img/ecommerce-images/category-page-07-product-04.jpg",
    imageAlt: "Placeholder product image.",
  },
];

export default function ShopPage() {
  if (!SHOP_ENABLED) notFound(); // dormant until real commerce ships

  return (
    <div className="flex flex-1 flex-col">
      <section className="bg-brand text-brand-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-16">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            Federation Store
          </p>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">
            Shop
          </h1>
          <p className="max-w-2xl text-white/85">
            Gear up in USVI Softball colors. This store is a preview — items,
            pricing, and checkout are placeholders until the shop officially opens.
          </p>
        </div>
      </section>

      <section
        data-testid="shop-grid"
        className="mx-auto w-full max-w-6xl px-4 py-16"
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {products.map((product) => (
            <div key={product.id} data-testid="shop-item" className="group">
              <div className="aspect-square w-full overflow-hidden rounded-2xl bg-surface">
                {/* Plain <img>: mock/external placeholder art, not a Storage asset, so it
                    stays outside next/image's pinned remotePatterns. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageSrc}
                  alt={product.imageAlt}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <h2 className="mt-4 font-display text-base font-bold text-brand">
                {product.name}
              </h2>
              <p className="text-sm text-muted">{product.availability}</p>
              <p className="mt-1 font-medium text-foreground">{product.price}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
