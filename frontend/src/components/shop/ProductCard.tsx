import { useState } from "react";
import { Heart, Package, Pencil, ShoppingCart, Trash2 } from "lucide-react";
import { Button, Skeleton, SkeletonText, StatusBadge } from "../ui";
import { Card, CardBody } from "../ui/Card";
import { cn } from "../../lib/cn";
import { formatPrice } from "../../lib/format";
import type { InventoryProduct } from "../../types/inventory";

/** Product picture; falls back to an icon when there is no image or it fails to load. */
export function ProductThumb({ product, className }: { product: InventoryProduct; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!product.imageUrl || failed) {
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
      src={product.imageUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("bg-slate-100 object-cover", className)}
    />
  );
}

export type ProductCardProps = {
  product: InventoryProduct;
  isAdmin: boolean;
  isFavorite: boolean;
  disabled?: boolean;
  /** Opens the product page. Fired by clicking the picture or the name. */
  onOpen: (product: InventoryProduct) => void;
  onEdit?: (product: InventoryProduct) => void;
  onDelete?: (product: InventoryProduct) => void;
  /** Adds the product to the cart and navigates to the Cart page. */
  onOrder: (product: InventoryProduct) => void;
  onToggleFavorite: (product: InventoryProduct) => void;
};

/** One product in the grid: picture, name, description, price, and Order / favorite. */
export function ProductCard({
  product,
  isAdmin,
  isFavorite,
  disabled = false,
  onOpen,
  onEdit,
  onDelete,
  onOrder,
  onToggleFavorite,
}: ProductCardProps) {
  const outOfStock = product.stock <= 0;

  return (
    <Card className="flex h-full flex-col overflow-hidden" aria-busy={disabled || undefined}>
      {/* Picture + status; the whole picture area opens the product page. */}
      <div className="relative aspect-[4/3]">
        <button
          type="button"
          aria-label={`View ${product.name}`}
          disabled={disabled}
          onClick={() => onOpen(product)}
          className="block h-full w-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500"
        >
          <ProductThumb product={product} className="h-full w-full" />
        </button>
        <div className="pointer-events-none absolute left-3 top-3">
          <StatusBadge status={product.status} />
        </div>
        {isAdmin && (onEdit || onDelete) && (
          <div className="absolute right-2 top-2 flex gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(product)}
                aria-label={`Edit ${product.name}`}
                className="rounded-control bg-white/90 p-2 text-slate-600 shadow-card transition hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-primary-500"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(product)}
                aria-label={`Delete ${product.name}`}
                className="rounded-control bg-white/90 p-2 text-slate-600 shadow-card transition hover:bg-white hover:text-danger-600 focus-visible:outline-2 focus-visible:outline-primary-500"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
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
            {outOfStock ? "None left" : `${product.stock} in stock`}
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
            Order
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
