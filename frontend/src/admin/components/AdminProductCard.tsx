import { Pencil, Trash2 } from "lucide-react";
import { Skeleton, SkeletonText, StatusBadge } from "../../components/ui";
import { Card, CardBody } from "../../components/ui/Card";
import { ProductThumb } from "../../components/shop/ProductCard";
import { cn } from "../../lib/cn";
import { formatPrice } from "../../lib/format";
import type { InventoryProduct } from "../../types/inventory";

/*
  The private inventory card used inside /admin/products. It keeps showing the
  exact stock, status and admin edit/delete actions — the public catalogue has
  its own customer-safe card (components/shop/ProductCard.tsx).
*/

export type AdminProductCardProps = {
  product: InventoryProduct;
  isAdmin: boolean;
  disabled?: boolean;
  onOpen: (product: InventoryProduct) => void;
  onEdit?: (product: InventoryProduct) => void;
  onDelete?: (product: InventoryProduct) => void;
};

export function AdminProductCard({
  product,
  isAdmin,
  disabled = false,
  onOpen,
  onEdit,
  onDelete,
}: AdminProductCardProps) {
  const outOfStock = product.stock <= 0;

  return (
    <Card className="flex h-full flex-col overflow-hidden" aria-busy={disabled || undefined}>
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
      </CardBody>
    </Card>
  );
}

export function AdminProductCardSkeleton() {
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
