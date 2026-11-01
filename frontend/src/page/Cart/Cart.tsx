import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Minus, Package, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import { Button, EmptyState } from "../../components/ui";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { MAX_CART_PRODUCTS, MAX_LINE_QUANTITY } from "../../context/cart/cart-context";
import { useCart } from "../../context/cart/useCart";
import { formatPrice } from "../../lib/format";
import { resolveImageUrl } from "../../lib/imageUrl";
import { useArea } from "../../routes/useArea";

/** Item row picture; falls back to an icon when there is none. */
function LineThumb({ imageUrl, name }: { imageUrl?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = resolveImageUrl(imageUrl);

  if (!src || failed) {
    return (
      <div
        className="flex size-20 shrink-0 items-center justify-center rounded-control bg-slate-100 text-slate-400 sm:size-24"
        aria-hidden="true"
      >
        <Package className="size-7" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className="size-20 shrink-0 rounded-control bg-slate-100 object-cover sm:size-24"
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
  // Inside a dashboard shell the layout owns the page background and padding,
  // and the catalogue/checkout links stay in that shell.
  const area = useArea();
  const inArea = area !== null;
  const productsPath = area === "customer" ? "/dashboard/products" : "/products";
  const checkoutPath = area === "customer" ? "/dashboard/checkout" : "/checkout";

  const overStocked = items.filter((row) => row.product.maxOrderable < row.quantity);
  const tooManyProducts = items.length > MAX_CART_PRODUCTS;
  const overQuantity = items.find((row) => row.quantity > MAX_LINE_QUANTITY);
  const checkoutBlocked = overStocked.length > 0 || tooManyProducts || Boolean(overQuantity);

  return (
    <div className={inArea ? undefined : "min-h-[calc(100vh_-_var(--header-h))] bg-surface-alt py-8 text-ink sm:py-10"}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-extrabold sm:text-4xl">
            Shopping Cart{" "}
            <span className="font-mono text-base font-semibold text-primary-600">
              ({totalItems} {totalItems === 1 ? "item" : "items"})
            </span>
          </h1>
          <Link
            to={productsPath}
            className="text-sm font-semibold text-primary-600 underline-offset-4 transition hover:underline"
          >
            Continue shopping →
          </Link>
        </div>

        {items.length === 0 ? (
          <Card className="mt-8">
            <EmptyState
              icon={<ShoppingBag className="size-10" aria-hidden="true" />}
              title="Your cart is empty"
              description="Browse the products and add something you like — it will wait for you here."
              action={
                <Link to={productsPath}>
                  <Button>Browse products</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
            {/* Items */}
            <div className="flex flex-col gap-3">
              {items.map((row) => {
                const overStock = row.product.maxOrderable < row.quantity;
                const outOfStock = row.product.maxOrderable <= 0;
                return (
                  <Card key={row.product.id} className="transition hover:border-primary-300">
                    <CardBody className="flex items-start gap-4 p-4">
                      <LineThumb imageUrl={row.product.imageUrl} name={row.product.name} />

                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold leading-snug text-ink">{row.product.name}</p>
                        <p className="mt-0.5 font-medium text-primary-600">{formatPrice(row.product.price)}</p>

                        {outOfStock ? (
                          <p className="mt-1 text-xs font-medium text-danger-600" role="alert">
                            This item is out of stock — remove it to check out.
                          </p>
                        ) : overStock ? (
                          <p className="mt-1 text-xs font-medium text-danger-600" role="alert">
                            Only {row.product.maxOrderable} available — reduce the quantity to check out.
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-4">
                          <div
                            className="inline-flex items-center rounded-control border border-line"
                            aria-label={`Quantity of ${row.product.name}`}
                          >
                            <button
                              type="button"
                              aria-label={`Decrease quantity of ${row.product.name}`}
                              disabled={row.quantity <= 1}
                              onClick={() => setQuantity(row.product.id, row.quantity - 1)}
                              className="flex size-9 items-center justify-center rounded-l-control text-ink transition hover:bg-surface-alt disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                              <Minus className="size-4" aria-hidden="true" />
                            </button>
                            <span className="w-10 text-center text-sm font-semibold" aria-live="polite">
                              {row.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase quantity of ${row.product.name}`}
                              disabled={outOfStock || row.quantity >= row.product.maxOrderable}
                              onClick={() => setQuantity(row.product.id, row.quantity + 1)}
                              className="flex size-9 items-center justify-center rounded-r-control text-ink transition hover:bg-surface-alt disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                              <Plus className="size-4" aria-hidden="true" />
                            </button>
                          </div>

                          <span className="text-sm font-bold text-ink">
                            {formatPrice(row.product.price * row.quantity)}
                          </span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted hover:text-danger-600"
                        aria-label={`Remove ${row.product.name} from cart`}
                        onClick={() => remove(row.product.id)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </CardBody>
                  </Card>
                );
              })}
            </div>

            {/* Order summary */}
            <Card className="overflow-hidden border-t-2 border-primary-500 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
              <CardHeader title="Order Summary" />
              <CardBody className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">
                    Subtotal ({totalItems} {totalItems === 1 ? "item" : "items"})
                  </span>
                  <span className="font-semibold text-ink">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Shipping</span>
                  <span className="font-semibold text-success-700">Free</span>
                </div>

                <div className="my-2 border-t border-dashed border-line" />

                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-ink">Total:</span>
                  <span className="font-mono text-2xl font-extrabold text-primary-600">
                    {formatPrice(subtotal)}
                  </span>
                </div>

                {tooManyProducts && (
                  <p className="text-xs font-medium text-danger-600" role="alert">
                    Your cart has {items.length} different products. Customer checkout allows at most{" "}
                    {MAX_CART_PRODUCTS} — remove {items.length - MAX_CART_PRODUCTS} to continue.
                  </p>
                )}
                {overQuantity && (
                  <p className="text-xs font-medium text-danger-600" role="alert">
                    You can order at most {MAX_LINE_QUANTITY} of {overQuantity.product.name} per order. Reduce
                    its quantity to continue.
                  </p>
                )}
                {overStocked.length > 0 && (
                  <p className="text-xs font-medium text-danger-600">
                    Fix the quantity of {overStocked.length === 1 ? overStocked[0].product.name : "the marked items"} before checking out.
                  </p>
                )}

                <Button
                  fullWidth
                  size="lg"
                  className="mt-1"
                  disabled={checkoutBlocked}
                  rightIcon={<ArrowRight className="size-4" aria-hidden="true" />}
                  onClick={() => navigate(checkoutPath)}
                >
                  Proceed to checkout
                </Button>

                <div className="mt-1 flex items-center justify-center gap-4 text-[11px] font-medium text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Truck className="size-3.5" aria-hidden="true" /> Fast delivery
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5" aria-hidden="true" /> Secure
                  </span>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
