import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  Heart,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { Button, Card, EmptyState, Skeleton, SkeletonText, useToast } from "../../components/ui";
import { useCart } from "../../context/cart/useCart";
import { useFavorites } from "../../context/favorites/useFavorites";
import { useCatalogProduct } from "../../hooks/useCatalog";
import { cn } from "../../lib/cn";
import { formatPrice } from "../../lib/format";
import { useArea } from "../../routes/useArea";
import { ProductThumb } from "../../components/shop/ProductCard";
import { catalogErrorMessage, isNotFound } from "./catalogError";

/** Quantity stepper: − [n] +, capped by the catalog's maxOrderable. */
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
    "flex size-11 items-center justify-center text-ink transition hover:bg-surface-alt disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div
      className="inline-flex items-center rounded-control border border-line bg-surface"
      aria-label="Quantity"
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        className={cn(btn, "rounded-l-control")}
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="w-12 text-center text-sm font-semibold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        className={cn(btn, "rounded-r-control")}
        disabled={disabled || atMax}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Small reassurance tile under the picture (delivery, payment, returns). */
function PerkTile({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-control border border-line bg-surface px-2 py-3 text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        {icon}
      </span>
      <span className="text-[11px] font-semibold leading-tight text-muted">{title}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
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
 * Public product detail: big picture, full description, price, availability and
 * the cart / favorites flows. No internal inventory fields are shown.
 */
export default function ProductDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: product, isPending, isError, error, refetch } = useCatalogProduct(id);

  const cart = useCart();
  const favorites = useFavorites();
  // Inside a dashboard shell the layout owns the page background and padding,
  // and product/cart links stay in that shell.
  const area = useArea();
  const inArea = area !== null;
  const productBase = area === "customer" ? "/dashboard/products" : "/products";
  const cartPath = area === "customer" ? "/dashboard/cart" : "/cart";

  const [quantity, setQuantity] = useState(1);

  if (isPending) {
    return (
      <div className={inArea ? undefined : "min-h-[calc(100vh_-_var(--header-h))] bg-surface-alt py-10 text-ink"}>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <DetailSkeleton />
        </div>
      </div>
    );
  }

  if (isError || !product) {
    const missing = isNotFound(error);
    return (
      <div className={inArea ? undefined : "min-h-[calc(100vh_-_var(--header-h))] bg-surface-alt py-10 text-ink"}>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <EmptyState
            icon={<Package className="size-6" aria-hidden="true" />}
            title={missing ? "Product not found" : "We couldn't load this product"}
            description={missing ? "It may be inactive or no longer sold." : catalogErrorMessage(error)}
            action={
              <div className="flex gap-2">
                {!missing && (
                  <Button variant="secondary" onClick={() => void refetch()}>
                    Try again
                  </Button>
                )}
                <Link to={productBase}>
                  <Button>All products</Button>
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const outOfStock = !product.inStock || product.maxOrderable <= 0;
  const maxQuantity = Math.max(product.maxOrderable, 1);
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
    <div className={inArea ? undefined : "min-h-[calc(100vh_-_var(--header-h))] bg-surface-alt py-8 text-ink sm:py-10"}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted">
          <Link to={productBase} className="flex items-center gap-1 transition hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Products
          </Link>
          <ChevronRight className="size-4" aria-hidden="true" />
          <span className="truncate font-medium text-ink">{product.name}</span>
        </nav>

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-2">
          {/* Picture + perks */}
          <div className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
            <Card className="overflow-hidden">
              <div className="relative bg-surface-alt">
                <ProductThumb key={product.id} product={product} className="aspect-[4/3] h-auto w-full" />
                <div className="pointer-events-none absolute left-4 top-4">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ring-1 ring-inset",
                      outOfStock
                        ? "bg-danger-50 text-danger-700 ring-danger-600/20"
                        : "bg-success-50 text-success-700 ring-success-600/20",
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                    {outOfStock ? "Out of stock" : "In stock"}
                  </span>
                </div>
              </div>
            </Card>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <PerkTile icon={<Truck className="size-4" aria-hidden="true" />} title="Fast delivery" />
              <PerkTile icon={<ShieldCheck className="size-4" aria-hidden="true" />} title="Secure checkout" />
              <PerkTile icon={<BadgeCheck className="size-4" aria-hidden="true" />} title="Quality assured" />
            </div>
          </div>

          {/* Info */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700">
                {product.category || "Uncategorised"}
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">{product.name}</h1>

            <div className="mt-5 flex items-end gap-3">
              <p className="text-4xl font-extrabold tracking-tight text-ink">{formatPrice(product.price)}</p>
            </div>
            <p className="mt-1 text-xs font-medium text-muted">Tax included · Cash on delivery available</p>

            <div className="mt-6 rounded-card border border-line bg-surface p-5 shadow-card">
              <h2 className="text-base font-bold text-ink">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
                {product.description?.trim() || "No description yet."}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <QuantityStepper
                value={quantity}
                max={maxQuantity}
                onChange={setQuantity}
                disabled={outOfStock}
              />
              <Button
                size="lg"
                className="flex-1 sm:flex-none"
                leftIcon={<ShoppingCart className="size-4" aria-hidden="true" />}
                disabled={outOfStock}
                onClick={addToCart}
              >
                {outOfStock ? "Out of stock" : "Add to cart"}
              </Button>
              <Button
                size="lg"
                variant={isFavorite ? "secondary" : "ghost"}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={isFavorite}
                onClick={toggleFavorite}
              >
                <Heart className={cn("size-5", isFavorite && "fill-current text-danger-600")} aria-hidden="true" />
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
              onClick={() => navigate(cartPath)}
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
