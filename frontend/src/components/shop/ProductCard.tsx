import { useState } from "react";
import { Heart, Package, ShoppingCart } from "lucide-react";
import { Button, Skeleton, SkeletonText } from "../ui";
import { Card, CardBody } from "../ui/Card";
import { cn } from "../../lib/cn";
import { formatPrice } from "../../lib/format";
import { resolveImageUrl } from "../../lib/imageUrl";
import type { ShopProduct } from "../../types/shop";

/** Product picture; falls back to an icon when there is no image or it fails to load. */
export function ProductThumb({
  product,
  className,
}: {
  product: Pick<ShopProduct, "imageUrl">;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = resolveImageUrl(product.imageUrl);

  if (!src || failed) {
    return (
      <div
        className={cn("flex items-center justify-center bg-slate-100 text-slate-400", className)}
        aria-hidden="true"
      >
        <Package className="size-10" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("block bg-slate-100 object-cover", className)}
    />
  );
}

export type ProductCardProps = {
  product: ShopProduct;
  isFavorite: boolean;
  disabled?: boolean;
  /** Opens the product page. Fired by clicking the picture or the name. */
  onOpen: (product: ShopProduct) => void;
  /** Adds the product to the cart and navigates to the Cart page. */
  onOrder: (product: ShopProduct) => void;
  onToggleFavorite: (product: ShopProduct) => void;
};

/** One product in the public grid: picture, name, description, price, availability and actions. */
export function ProductCard({
  product,
  isFavorite,
  disabled = false,
  onOpen,
  onOrder,
  onToggleFavorite,
}: ProductCardProps) {
  const outOfStock = !product.inStock || product.maxOrderable <= 0;

  return (
    <Card className="flex h-full flex-col overflow-hidden" aria-busy={disabled || undefined}>
      {/* Picture + availability; the whole picture area opens the product page. */}
      {/* overflow-hidden keeps every card the same 4:3 size, whatever the photo's ratio. */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <button
          type="button"
          aria-label={`View ${product.name}`}
          disabled={disabled}
          onClick={() => onOpen(product)}
          className="absolute inset-0 block h-full w-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500"
        >
          <ProductThumb product={product} className="h-full w-full" />
        </button>
        <div className="pointer-events-none absolute left-3 top-3">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
              outOfStock ? "bg-danger-50 text-danger-700" : "bg-success-50 text-success-700",
            )}
          >
            {outOfStock ? "Out of stock" : "In stock"}
          </span>
        </div>
      </div>

      <CardBody className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {product.category || "Uncategorised"}
        </p>
        {/* Name opens the product page too. */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onOpen(product)}
          className="text-left text-base font-bold leading-snug text-ink transition hover:text-primary-600 focus-visible:outline-2 focus-visible:outline-primary-500"
        >
          {product.name}
        </button>
        <p className="min-h-10 text-sm leading-snug text-muted line-clamp-2">
          {product.description ?? "No description yet."}
        </p>

        <div className="mt-auto flex items-baseline justify-between pt-2">
          <span className="text-lg font-bold text-ink">{formatPrice(product.price)}</span>
          <span className={cn("text-xs font-medium", outOfStock ? "text-danger-600" : "text-muted")}>
            {outOfStock ? "Out of stock" : "In stock"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <Button
            size="sm"
            className="flex-1"
            leftIcon={<ShoppingCart className="size-4" aria-hidden="true" />}
            disabled={disabled || outOfStock}
            onClick={() => onOrder(product)}
          >
            {outOfStock ? "Out of stock" : "Order"}
          </Button>
          <Button
            size="sm"
            variant={isFavorite ? "secondary" : "ghost"}
            aria-label={isFavorite ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
            aria-pressed={isFavorite}
            disabled={disabled}
            onClick={() => onToggleFavorite(product)}
          >
            <Heart
              className={cn("size-4", isFavorite && "fill-current text-danger-600")}
              aria-hidden="true"
            />
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/** Grey placeholder card while the products are loading. */
export function ProductCardSkeleton() {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <CardBody className="flex flex-1 flex-col gap-2 p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-4/5" />
        <SkeletonText lines={2} className="pt-1" />
        <Skeleton className="mt-4 h-6 w-24" />
        <Skeleton className="h-9 w-full" />
      </CardBody>
    </Card>
  );
}
