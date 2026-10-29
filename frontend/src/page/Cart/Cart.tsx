import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Package, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button, EmptyState } from "../../components/ui";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { useCart } from "../../context/cart/useCart";
import { formatPrice } from "../../lib/format";
import { resolveImageUrl } from "../../lib/imageUrl";

/** Item row picture; falls back to an icon when there is none. */
function LineThumb({ imageUrl, name }: { imageUrl?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = resolveImageUrl(imageUrl);

  if (!src || failed) {
    return (
      <div className="flex size-16 shrink-0 items-center justify-center rounded-control bg-slate-100 text-slate-400" aria-hidden="true">
        <Package className="size-6" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className="size-16 shrink-0 rounded-control bg-slate-100 object-cover"
    />
  );
}

/**
 * Shopping cart: its items live client-side (localStorage). "Proceed to
 * checkout" hands over to the /checkout page, where the details are filled
 * in and ONE real order is placed through POST /orders.
 */
export default function Cart() {
  const { items, totalItems, subtotal, setQuantity, remove } = useCart();
  const navigate = useNavigate();

  const overStocked = items.filter((row) => row.product.stock < row.quantity);

  return (
    <div className="min-h-[calc(100vh-128px)] bg-surface-alt py-10 text-ink">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <h1 className="text-3xl font-bold">
          Shopping Cart{" "}
          <span className="font-mono text-base font-semibold text-primary-600">
            ({totalItems} {totalItems === 1 ? "item" : "items"})
          </span>
        </h1>

        {items.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<ShoppingBag className="size-10" aria-hidden="true" />}
              title="Your cart is empty"
              description="Browse the products and add something you like — it will wait for you here."
              action={
                <Link to="/products">
                  <Button>Browse products</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
            {/* Items */}
            <div className="flex flex-col gap-3">
              {items.map((row) => {
                const overStock = row.product.stock < row.quantity;
                return (
                  <Card key={row.product.id}>
                    <CardBody className="flex items-start gap-4 p-4">
                      <LineThumb imageUrl={row.product.imageUrl} name={row.product.name} />

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug text-ink">
                          {row.product.name}
                          <span className="ml-2 font-mono text-xs font-normal text-muted">{row.product.sku}</span>
                        </p>
                        <p className="mt-0.5 font-medium text-primary-600">{formatPrice(row.product.price)}</p>

                        {overStock && (
                          <p className="mt-1 text-xs font-medium text-danger-600" role="alert">
                            Only {row.product.stock} left in stock — reduce the quantity to check out.
                          </p>
                        )}

                        <div
                          className="mt-3 inline-flex items-center rounded-control border border-line"
                          aria-label={`Quantity of ${row.product.name}`}
                        >
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${row.product.name}`}
                            disabled={row.quantity <= 1}
                            onClick={() => setQuantity(row.product.id, row.quantity - 1)}
                            className="flex size-8 items-center justify-center rounded-l-control text-ink transition hover:bg-surface-alt disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            <Minus className="size-4" aria-hidden="true" />
                          </button>
                          <span className="w-10 text-center text-sm font-semibold" aria-live="polite">
                            {row.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${row.product.name}`}
                            disabled={row.product.stock <= 0 || row.quantity >= row.product.stock}
                            onClick={() => setQuantity(row.product.id, row.quantity + 1)}
                            className="flex size-8 items-center justify-center rounded-r-control text-ink transition hover:bg-surface-alt disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            <Plus className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col items-end justify-between self-stretch">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove ${row.product.name} from cart`}
                          onClick={() => remove(row.product.id)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                        <span className="text-sm font-bold text-ink">
                          {formatPrice(row.product.price * row.quantity)}
                        </span>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>

            {/* Order summary */}
            <Card className="overflow-hidden border-t-2 border-primary-500">
              <CardHeader title="Order Summary" />
              <CardBody className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Subtotal ({totalItems} {totalItems === 1 ? "item" : "items"})</span>
                  <span className="font-semibold text-ink">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Shipping</span>
                  <span className="font-semibold text-ink">Free</span>
                </div>

                <div className="my-2 border-t border-dashed border-line" />

                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-ink">Total:</span>
                  <span className="font-mono text-xl font-bold text-primary-600">
                    {formatPrice(subtotal)}
                  </span>
                </div>

                {overStocked.length > 0 && (
                  <p className="text-xs font-medium text-danger-600">
                    Fix the quantity of {overStocked.length === 1 ? overStocked[0].product.name : "the marked items"} before checking out.
                  </p>
                )}

                <Button
                  fullWidth
                  disabled={overStocked.length > 0}
                  onClick={() => navigate("/checkout")}
                >
                  Proceed to checkout
                </Button>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
