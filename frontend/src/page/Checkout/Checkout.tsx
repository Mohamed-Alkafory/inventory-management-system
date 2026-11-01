import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, CreditCard, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { z } from "zod";
import { Button, Card, CardBody, CardHeader, Field, Input, Textarea, useToast } from "../../components/ui";
import { useAuth } from "../../context/auth/useAuth";
import { MAX_CART_PRODUCTS, MAX_LINE_QUANTITY } from "../../context/cart/cart-context";
import { useCart } from "../../context/cart/useCart";
import { orderPath } from "../../features/orders/format";
import { useCreateMyOrder } from "../../features/orders/hooks";
import type { CreateMyOrderInput } from "../../features/orders/types";
import { formatPrice } from "../../lib/format";
import { ApiError } from "../../lib/http";
import { useArea } from "../../routes/useArea";

/*
  POST /orders/mine knows the shipping details and the item lines. Prices,
  totals and ownership are always computed by the server from the token.
*/
type CheckoutForm = {
  recipientName: string;
  recipientPhone: string;
  shippingCity: string;
  shippingAddress: string;
  notes: string;
};

const EMPTY_FORM: CheckoutForm = {
  recipientName: "",
  recipientPhone: "",
  shippingCity: "",
  shippingAddress: "",
  notes: "",
};

/** Length limits mirror CreateOwnOrderDto on the backend. */
const checkoutSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(1, "Full name is required.")
    .max(100, "Full name must be 100 characters or fewer."),
  recipientPhone: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .max(20, "Phone number must be 20 characters or fewer."),
  shippingCity: z
    .string()
    .trim()
    .min(1, "City is required.")
    .max(100, "City must be 100 characters or fewer."),
  shippingAddress: z
    .string()
    .trim()
    .min(1, "Address is required.")
    .max(500, "Address must be 500 characters or fewer."),
  notes: z.string().trim().max(2000, "Notes must be 2000 characters or fewer."),
});

type FormErrors = Partial<Record<keyof CheckoutForm, string>>;

const FIELD_KEYS: Array<keyof CheckoutForm> = [
  "recipientName",
  "recipientPhone",
  "shippingCity",
  "shippingAddress",
  "notes",
];

/** The 409 body is a human message that names the failing product id. */
function stockConflictItem(error: ApiError, items: ReturnType<typeof useCart>["items"]) {
  const message = error.serverMessage ?? error.message;
  const productId = /product\s+([^\s]+)\s+change/i.exec(message)?.[1];
  return productId ? items.find((row) => String(row.product.id) === productId) : undefined;
}

/** One step in the little "Cart → Delivery → Confirmation" tracker. */
function Step({ label, state }: { label: string; state: "done" | "current" | "upcoming" }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          state === "done"
            ? "flex size-6 items-center justify-center rounded-full bg-primary-600 text-white"
            : state === "current"
              ? "flex size-6 items-center justify-center rounded-full border-2 border-primary-600 bg-primary-50 text-[11px] font-bold text-primary-700"
              : "flex size-6 items-center justify-center rounded-full border border-line bg-surface text-[11px] font-bold text-muted"
        }
      >
        {state === "done" ? <Check className="size-3.5" aria-hidden="true" /> : state === "current" ? "2" : "3"}
      </span>
      <span
        className={
          state === "upcoming" ? "text-xs font-medium text-muted" : "text-xs font-semibold text-ink"
        }
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Checkout: delivery details and the order summary, then ONE real order
 * through POST /orders/mine. The server recomputes every price and validates
 * the stock; the cart is only cleared after a successful placement.
 */
export default function Checkout() {
  const { items, totalItems, subtotal, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const placeOrder = useCreateMyOrder();
  // Inside a dashboard shell the layout owns the page background and padding,
  // and the cart link stays in that shell.
  const area = useArea();
  const inArea = area !== null;
  const cartPath = area === "customer" ? "/dashboard/cart" : "/cart";

  const [form, setForm] = useState<CheckoutForm>(() => ({
    ...EMPTY_FORM,
    recipientName: user?.name ?? "",
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [orderError, setOrderError] = useState<string | null>(null);
  // After a successful order the cart is intentionally empty; don't bounce to /cart.
  const orderPlaced = useRef(false);

  // The route guards this already; keep the page safe when mounted directly.
  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true, state: { from: { pathname: "/checkout" } } });
    }
  }, [user, navigate]);

  // Nothing to check out — back to the cart.
  const cartIsEmpty = items.length === 0;
  useEffect(() => {
    if (user && cartIsEmpty && !placeOrder.isPending && !orderPlaced.current) {
      navigate(cartPath, { replace: true });
    }
  }, [user, cartIsEmpty, placeOrder.isPending, navigate, cartPath]);

  const tooManyProducts = items.length > MAX_CART_PRODUCTS;
  const overQuantity = items.find((row) => row.quantity > MAX_LINE_QUANTITY);
  const checkoutBlocked = tooManyProducts || Boolean(overQuantity);

  const setField =
    (field: keyof CheckoutForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
      setOrderError(null);
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (tooManyProducts) {
      setOrderError(
        `Your cart has ${items.length} different products. Customer checkout allows at most ${MAX_CART_PRODUCTS} — remove ${items.length - MAX_CART_PRODUCTS} to continue.`,
      );
      return;
    }
    if (overQuantity) {
      setOrderError(
        `You can order at most ${MAX_LINE_QUANTITY} of ${overQuantity.product.name} per order. Reduce its quantity to continue.`,
      );
      return;
    }

    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && FIELD_KEYS.includes(field as keyof CheckoutForm)) {
          nextErrors[field as keyof CheckoutForm] ??= issue.message;
        }
      }
      setErrors(nextErrors);
      setOrderError(null);
      return;
    }

    setErrors({});
    setOrderError(null);

    const input: CreateMyOrderInput = {
      items: items.map((row) => ({ productId: row.product.id, quantity: row.quantity })),
      recipientName: parsed.data.recipientName,
      recipientPhone: parsed.data.recipientPhone,
      shippingAddress: parsed.data.shippingAddress,
      shippingCity: parsed.data.shippingCity,
      notes: parsed.data.notes || undefined,
    };

    try {
      const order = await placeOrder.mutateAsync(input);
      orderPlaced.current = true;
      clear();
      toast.success(`Order ${order.orderNumber} placed — ${formatPrice(order.totalAmount)}`);
      navigate(orderPath(order.id));
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          const item = stockConflictItem(error, items);
          setOrderError(
            item
              ? `“${item.product.name}” no longer has enough stock. Adjust its quantity in the cart and try again.`
              : "Some items no longer have enough stock — adjust your cart and try again.",
          );
          return;
        }

        if (error.status === 400) {
          const nextErrors: FormErrors = {};
          for (const field of FIELD_KEYS) {
            const message = error.fieldErrors[field];
            if (message) nextErrors[field] = message;
          }
          setErrors(nextErrors);
          setOrderError(
            Object.keys(nextErrors).length > 0
              ? "Please fix the highlighted fields and try again."
              : error.message,
          );
          return;
        }

        if (error.status === 429) {
          setOrderError(
            "You’ve placed a few orders in a short time. Please wait a minute and try again.",
          );
          return;
        }

        setOrderError(error.message);
        return;
      }

      setOrderError("Couldn't place the order. Please try again.");
    }
  };

  if (!user) return null;

  return (
    <div className={inArea ? undefined : "min-h-[calc(100vh_-_var(--header-h))] bg-surface-alt py-8 text-ink sm:py-10"}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">Checkout</h1>
            <p className="mt-1 text-sm text-muted">Almost there — confirm your delivery details.</p>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <Step label="Cart" state="done" />
            <span className="h-px w-6 bg-line" aria-hidden="true" />
            <Step label="Delivery" state="current" />
            <span className="h-px w-6 bg-line" aria-hidden="true" />
            <Step label="Confirmation" state="upcoming" />
          </div>
        </div>

        <form className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem]" onSubmit={handleSubmit} noValidate>
          {/* Delivery details */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader
                title="Delivery Details"
                description="Where should we send your order?"
                action={
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                    <MapPin className="size-4" aria-hidden="true" />
                  </span>
                }
              />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Full name" required error={errors.recipientName}>
                    {(control) => (
                      <Input
                        {...control}
                        type="text"
                        autoComplete="name"
                        maxLength={100}
                        placeholder="Full name"
                        value={form.recipientName}
                        onChange={setField("recipientName")}
                      />
                    )}
                  </Field>
                </div>
                <Field label="Phone number" required error={errors.recipientPhone}>
                  {(control) => (
                    <Input
                      {...control}
                      type="tel"
                      autoComplete="tel"
                      maxLength={20}
                      placeholder="Phone number"
                      value={form.recipientPhone}
                      onChange={setField("recipientPhone")}
                    />
                  )}
                </Field>
                <Field label="City" required error={errors.shippingCity}>
                  {(control) => (
                    <Input
                      {...control}
                      type="text"
                      autoComplete="address-level2"
                      maxLength={100}
                      placeholder="City"
                      value={form.shippingCity}
                      onChange={setField("shippingCity")}
                    />
                  )}
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Address" required error={errors.shippingAddress}>
                    {(control) => (
                      <Input
                        {...control}
                        type="text"
                        autoComplete="street-address"
                        maxLength={500}
                        placeholder="Street, building, apartment…"
                        value={form.shippingAddress}
                        onChange={setField("shippingAddress")}
                      />
                    )}
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Order notes" hint="Optional — delivery instructions for the courier." error={errors.notes}>
                    {(control) => (
                      <Textarea
                        {...control}
                        rows={3}
                        maxLength={2000}
                        placeholder="Anything we should know? (optional)"
                        value={form.notes}
                        onChange={setField("notes")}
                      />
                    )}
                  </Field>
                </div>
              </CardBody>
            </Card>

            <div className="flex items-center gap-2 rounded-control border border-line bg-surface px-4 py-3 text-xs text-muted">
              <ShieldCheck className="size-4 shrink-0 text-success-600" aria-hidden="true" />
              Your details are only used to deliver this order. Payment is collected on delivery.
            </div>
          </div>

          {/* Order summary */}
          <Card className="overflow-hidden border-t-2 border-primary-500 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
            <CardHeader
              title="Order Summary"
              action={
                <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <CreditCard className="size-4" aria-hidden="true" />
                </span>
              }
            />
            <CardBody className="flex flex-col gap-3">
              <ul className="flex flex-col gap-2">
                {items.map((row) => (
                  <li key={row.product.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted">
                      {row.product.name} <span className="font-mono">× {row.quantity}</span>
                    </span>
                    <span className="whitespace-nowrap font-semibold text-ink">
                      {formatPrice(row.product.price * row.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between pt-1 text-sm">
                <span className="text-muted">
                  Subtotal ({totalItems} {totalItems === 1 ? "item" : "items"})
                </span>
                <span className="font-semibold text-ink">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Shipping</span>
                <span className="font-semibold text-success-700">Free</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Payment</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                  <Wallet className="size-4 text-primary-600" aria-hidden="true" />
                  Cash on delivery
                </span>
              </div>

              <div className="my-2 border-t border-dashed border-line" />

              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-ink">Total:</span>
                <span className="font-mono text-2xl font-extrabold text-primary-600">{formatPrice(subtotal)}</span>
              </div>

              {tooManyProducts && (
                <p className="text-xs font-medium text-danger-600" role="alert">
                  Your cart has {items.length} different products. Customer checkout allows at most{" "}
                  {MAX_CART_PRODUCTS} — remove {items.length - MAX_CART_PRODUCTS} to continue.
                </p>
              )}
              {overQuantity && (
                <p className="text-xs font-medium text-danger-600" role="alert">
                  You can order at most {MAX_LINE_QUANTITY} of {overQuantity.product.name} per order.
                </p>
              )}

              {orderError && (
                <p className="text-xs font-medium text-danger-600" role="alert">
                  {orderError}
                </p>
              )}

              <Button
                type="submit"
                fullWidth
                size="lg"
                className="mt-2"
                loading={placeOrder.isPending}
                disabled={checkoutBlocked}
                leftIcon={<Wallet className="size-4" aria-hidden="true" />}
              >
                Place order
              </Button>

              <Link
                to={cartPath}
                className="inline-flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-muted underline-offset-4 transition hover:text-ink hover:underline"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Back to cart
              </Link>
            </CardBody>
          </Card>
        </form>
      </div>
    </div>
  );
}
