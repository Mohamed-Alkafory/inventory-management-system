import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Heart, Minus, Package, Plus, ShoppingCart } from "lucide-react";
import { ApiError } from "../../api/errors";
import { Button, Card, EmptyState, Skeleton, SkeletonText, StatusBadge, useToast } from "../../components/ui";
import { useAuth } from "../../context/auth/useAuth";
import { useCart } from "../../context/cart/useCart";
import { useFavorites } from "../../context/favorites/useFavorites";
import { useProduct } from "../../hooks/useProducts";
import { cn } from "../../lib/cn";
import { formatPrice } from "../../lib/format";
import { ProductThumb } from "../../components/shop/ProductCard";

/** Quantity stepper shared with the cart page: − [n] +, clamped by stock. */
function QuantityStepper({
  value,
  max,
  onChange,
  disabled,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  disabled: boolean;
}) {
  const atMax = value >= max;
  const btn =
    "flex size-10 items-center justify-center text-ink transition hover:bg-surface-alt disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="inline-flex items-center rounded-control border border-line" aria-label="Quantity">
      <button type="button" aria-label="Decrease quantity" className={cn(btn, "rounded-l-control")} disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="w-12 text-center text-sm font-semibold" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label="Increase quantity" className={cn(btn, "rounded-r-control")} disabled={disabled || atMax} onClick={() => onChange(value + 1)}>
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <Skeleton className="aspect-[4/3] rounded-none" />
      </Card>
      <div className="space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-24" />
        <SkeletonText lines={4} className="pt-2" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-64" />
      </div>
    </div>
  );
}

/**
 * Product detail page: big picture, full description, price, quantity and
 * the same cart / favorites flows as the catalogue.
 */
export default function ProductDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN");
  const { data: product, isPending, isError, error, refetch } = useProduct(id);

  const cart = useCart();
  const favorites = useFavorites();

  const [quantity, setQuantity] = useState(1);

  if (isPending) {
    return (
      <div className="min-h-[calc(100vh-128px)] bg-surface-alt py-10 text-ink">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <DetailSkeleton />
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="min-h-[calc(100vh-128px)] bg-surface-alt py-10 text-ink">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <EmptyState
            icon={<Package className="size-6" aria-hidden="true" />}
            title="We couldn't load this product"
            description={error instanceof ApiError ? error.message : "Please try again in a moment."}
            action={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void refetch()}>
                  Try again
                </Button>
                <Link to="/products">
                  <Button>All products</Button>
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const outOfStock = product.stock <= 0;
  const isFavorite = favorites.has(product.id);

  const addToCart = () => {
    cart.addToCart(product, quantity);
    toast.success("Added to cart");
  };

  const toggleFavorite = () => {
    favorites.toggle(product);
    toast.success(isFavorite ? "Removed from favorites" : "Added to favorites");
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-surface-alt py-10 text-ink">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted">
          <Link to="/products" className="flex items-center gap-1 transition hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Products
          </Link>
          <ChevronRight className="size-4" aria-hidden="true" />
          <span className="font-medium text-ink">{product.name}</span>
        </nav>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          {/* Picture */}
          <Card className="overflow-hidden">
            <ProductThumb key={product.id} product={product} className="aspect-[4/3] h-auto w-full" />
          </Card>

          {/* Info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {product.category || "Uncategorised"} · SKU {product.sku}
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight">{product.name}</h1>

            <div className="mt-3 flex items-center gap-3">
              <StatusBadge status={product.status} />
              <span className={cn("text-sm font-medium", outOfStock ? "text-danger-600" : "text-muted")}>
                {outOfStock ? "Out of stock" : `${product.stock} in stock`}
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold text-ink">{formatPrice(product.price)}</p>
            {isAdmin && product.costPrice !== undefined && (
              <p className="mt-1 text-sm text-muted">
                Cost price: {formatPrice(product.costPrice)} · Reorder level: {product.reorderLevel}
              </p>
            )}

            <div className="mt-6 border-t border-line pt-6">
              <h2 className="text-base font-bold">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
                {product.description?.trim() || "No description yet."}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <QuantityStepper
                value={quantity}
                max={Math.max(product.stock, 1)}
                onChange={setQuantity}
                disabled={outOfStock}
              />
              <Button
                className="flex-1 sm:flex-none"
                leftIcon={<ShoppingCart className="size-4" aria-hidden="true" />}
                disabled={outOfStock}
                onClick={addToCart}
              >
                {outOfStock ? "Out of stock" : "Add to cart"}
              </Button>
              <Button
                variant={isFavorite ? "secondary" : "ghost"}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={isFavorite}
                onClick={toggleFavorite}
              >
                <Heart className={cn("size-4", isFavorite && "fill-current text-danger-600")} aria-hidden="true" />
                {isFavorite ? "In favorites" : "Favorite"}
              </Button>
            </div>

            {outOfStock && (
              <p className="mt-3 text-sm font-medium text-danger-600">
                This item is out of stock right now — check back soon.
              </p>
            )}

            <button
              type="button"
              onClick={() => navigate("/cart")}
              className="mt-4 text-sm font-semibold text-primary-600 underline-offset-4 transition hover:underline"
            >
              Go to cart →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
