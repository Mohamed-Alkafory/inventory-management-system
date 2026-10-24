import { FaShoppingCart, FaStar } from "react-icons/fa";
import type { Product } from "../../types/product";
import { formatPrice } from "../../lib/format";

type Props = {
  product: Product;
};

export default function ProductCard({ product }: Props) {
  const { title, brand, rating, price, thumbnail } = product;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-lg">
      <div className="aspect-square bg-slate-100">
        <img
          src={thumbnail}
          alt={title}
          loading="lazy"
          className="h-full w-full object-contain p-2"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">
          {brand ?? "Prodexa"}
        </span>
        <h3 className="line-clamp-2 font-semibold text-slate-900">{title}</h3>

        <div className="flex items-center gap-1 text-sm">
          <FaStar className="text-amber-500" aria-hidden="true" />
          <span className="text-slate-600">{rating.toFixed(1)}</span>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <strong className="text-slate-900">{formatPrice(price)}</strong>
          <button
            type="button"
            aria-label={`Add ${title} to cart`}
            className="rounded-lg bg-primary-600 p-2.5 text-white transition hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            <FaShoppingCart />
          </button>
        </div>
      </div>
    </article>
  );
}
