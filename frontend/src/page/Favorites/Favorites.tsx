import { Link, useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { Button, EmptyState } from "../../components/ui";
import { ProductCard } from "../../components/shop/ProductCard";
import { useCart } from "../../context/cart/useCart";
import { useFavorites } from "../../context/favorites/useFavorites";
import type { ShopProduct } from "../../types/shop";

/**
 * Products the visitor hearted on the catalogue. Everything is client-side
 * (localStorage); the order flow via the cart is shared with /products.
 */
export default function Favorites() {
  const favorites = useFavorites();
  const cart = useCart();
  const navigate = useNavigate();

  /** Order click → put the product in the cart, then jump to the Cart page. */
  const handleOrder = (product: ShopProduct) => {
    cart.addToCart(product);
    navigate("/cart");
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-surface-alt py-10 text-ink">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <h1 className="text-3xl font-bold">
          Favorites{" "}
          <span className="font-mono text-base font-semibold text-primary-600">
            ({favorites.items.length} {favorites.items.length === 1 ? "item" : "items"})
          </span>
        </h1>

        <div
          className={cnGrid(favorites.items.length)}
          aria-live="polite"
        >
          {favorites.items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isFavorite
              onOpen={(product) => navigate(`/products/${product.id}`)}
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
                <Link to="/products">
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
    : "mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}
