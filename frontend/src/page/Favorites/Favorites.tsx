import { Link, useNavigate } from "react-router-dom";
import { Heart, Sparkles } from "lucide-react";
import { Button, EmptyState } from "../../components/ui";
import { ProductCard } from "../../components/shop/ProductCard";
import { useCart } from "../../context/cart/useCart";
import { useFavorites } from "../../context/favorites/useFavorites";
import { useArea } from "../../routes/useArea";
import type { ShopProduct } from "../../types/shop";

/**
 * Products the visitor hearted on the catalogue. Everything is client-side
 * (localStorage); the order flow via the cart is shared with /products.
 */
export default function Favorites() {
  const favorites = useFavorites();
  const cart = useCart();
  const navigate = useNavigate();
  // Inside a dashboard shell the layout owns the page background and padding.
  const area = useArea();
  const inArea = area !== null;
  const productsPath = area === "customer" ? "/dashboard/products" : "/products";
  const cartPath = area === "customer" ? "/dashboard/cart" : "/cart";
  const productPath = (id: string) =>
    area === "customer" ? `/dashboard/products/${id}` : `/products/${id}`;

  /** Order click → put the product in the cart, then jump to the Cart page. */
  const handleOrder = (product: ShopProduct) => {
    cart.addToCart(product);
    navigate(cartPath);
  };

  return (
    <div className={inArea ? undefined : "min-h-[calc(100vh_-_var(--header-h))] bg-surface-alt py-8 text-ink sm:py-10"}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              Favorites{" "}
              <span className="font-mono text-base font-semibold text-primary-600">
                ({favorites.items.length} {favorites.items.length === 1 ? "item" : "items"})
              </span>
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Sparkles className="size-4 text-primary-500" aria-hidden="true" />
              Saved for later — order them in a tap.
            </p>
          </div>
          <Link
            to={productsPath}
            className="text-sm font-semibold text-primary-600 underline-offset-4 transition hover:underline"
          >
            Continue shopping →
          </Link>
        </div>

        <div className={cnGrid(favorites.items.length)} aria-live="polite">
          {favorites.items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isFavorite
              onOpen={(item) => navigate(productPath(item.id))}
              onOrder={handleOrder}
              onToggleFavorite={favorites.toggle}
            />
          ))}
        </div>

        {favorites.items.length === 0 && (
          <div className="mt-8">
            <EmptyState
              icon={<Heart className="size-6" aria-hidden="true" />}
              title="No favorites yet"
              description="Tap the heart on any product to keep it here for later."
              action={
                <Link to={productsPath}>
                  <Button>Browse products</Button>
                </Link>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Same grid as the products catalogue; collapses to a block wrapper for the empty state. */
function cnGrid(count: number): string {
  return count === 0
    ? "mt-4"
    : "mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}
