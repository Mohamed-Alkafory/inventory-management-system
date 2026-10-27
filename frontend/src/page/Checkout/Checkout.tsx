import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaCreditCard, FaPaypal, FaTruck } from "react-icons/fa";
import { Wallet } from "lucide-react";
import { ApiError } from "../../api/errors";
import { Button, Card, CardBody, CardHeader, Field, Input, useToast } from "../../components/ui";
import { useCreateOrder } from "../../features/orders/hooks";
import { useCart } from "../../context/cart/useCart";
import { formatPrice } from "../../lib/format";
import { cn } from "../../lib/cn";

/*
  POST /orders knows: customerName, customerPhone, notes (free text) and the
  item lines. Everything else this page collects — email, address, payment
  method — is packed into the notes, so nothing the customer typed is lost.
*/
const PAYMENT_METHODS = [
  { value: "Cash on delivery", icon: FaTruck },
  { value: "Credit / Debit card", icon: FaCreditCard },
  { value: "PayPal", icon: FaPaypal },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

type CheckoutForm = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  street: string;
  apartment: string;
  postalCode: string;
};

const EMPTY_FORM: CheckoutForm = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  street: "",
  apartment: "",
  postalCode: "",
};

/** Required fields of the checkout form, in display order. */
const REQUIRED: Array<{ field: keyof CheckoutForm; label: string }> = [
  { field: "fullName", label: "Full name" },
  { field: "phone", label: "Phone number" },
  { field: "country", label: "Country" },
  { field: "city", label: "City" },
  { field: "street", label: "Street address" },
];

/** The server only knows name/phone/notes: fold the rest of the form into the notes. */
function buildNotes(form: CheckoutForm, payment: PaymentMethod): string | undefined {
  const lines = [
    form.email && `Email: ${form.email.trim()}`,
    form.street.trim() &&
      `Shipping: ${[form.street.trim(), form.apartment.trim()].filter(Boolean).join(", ")}`,
    form.city.trim() && `City: ${form.city.trim()}`,
    form.country.trim() && `Country: ${form.country.trim()}`,
    form.postalCode.trim() && `Postal code: ${form.postalCode.trim()}`,
    `Payment: ${payment}`,
  ];
  const joined = lines.filter(Boolean).join("\n");
  return joined.trim() === "" ? undefined : joined.slice(0, 2000);
}

/**
 * Checkout: billing + shipping details, payment method and the order summary,
 * then ONE real order through POST /orders (which recomputes every price and
 * re-validates the stock server-side).
 */
export default function Checkout() {
  const { items, totalItems, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const toast = useToast();
  const placeOrder = useCreateOrder();

  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [payment, setPayment] = useState<PaymentMethod>("Cash on delivery");
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({});
  const [orderError, setOrderError] = useState<string | null>(null);

  // Nothing to check out — back to the cart.
  const cartIsEmpty = items.length === 0;
  useEffect(() => {
    if (cartIsEmpty && !placeOrder.isPending) navigate("/cart", { replace: true });
  }, [cartIsEmpty, placeOrder.isPending, navigate]);

  const setField = (field: keyof CheckoutForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setOrderError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Partial<Record<keyof CheckoutForm, string>> = {};
    for (const { field, label } of REQUIRED) {
      if (!form[field].trim()) nextErrors[field] = `${label} is required.`;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const order = await placeOrder.mutateAsync({
        items: items.map((row) => ({ productId: row.product.id, quantity: row.quantity })),
        customerName: form.fullName.trim(),
        customerPhone: form.phone.trim() || undefined,
        notes: buildNotes(form, payment),
      });
      clear();
      toast.success(`Order ${order.orderNumber} placed — ${formatPrice(order.totalAmount)}`);
      navigate("/products");
    } catch (error) {
      setOrderError(
        error instanceof ApiError
          ? error.status === 409
            ? "Some items no longer have enough stock — adjust your cart and try again."
            : error.message
          : "Couldn't place the order. Please try again.",
      );
    }
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-surface-alt py-10 text-ink">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <h1 className="text-3xl font-bold">Checkout</h1>

        <form className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem]" onSubmit={handleSubmit} noValidate>
          {/* Details */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title="Billing Details" />
              <CardBody className="flex flex-col gap-4">
                <Field label="Full name" required error={errors.fullName}>
                  {(control) => (
                    <Input
                      {...control}
                      type="text"
                      autoComplete="name"
                      maxLength={100}
                      placeholder="Full name"
                      value={form.fullName}
                      onChange={setField("fullName")}
                    />
                  )}
                </Field>
                <Field label="Email address" hint="Kept in the order notes for delivery coordination.">
                  {(control) => (
                    <Input
                      {...control}
                      type="email"
                      autoComplete="email"
                      placeholder="Email address"
                      value={form.email}
                      onChange={setField("email")}
                    />
                  )}
                </Field>
                <Field label="Phone number" required error={errors.phone}>
                  {(control) => (
                    <Input
                      {...control}
                      type="tel"
                      autoComplete="tel"
                      maxLength={20}
                      placeholder="Phone number"
                      value={form.phone}
                      onChange={setField("phone")}
                    />
                  )}
                </Field>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Shipping Details" />
              <CardBody className="flex flex-col gap-4">
                <Field label="Country" required error={errors.country}>
                  {(control) => (
                    <Input
                      {...control}
                      type="text"
                      autoComplete="country-name"
                      placeholder="Country"
                      value={form.country}
                      onChange={setField("country")}
                    />
                  )}
                </Field>
                <Field label="City" required error={errors.city}>
                  {(control) => (
                    <Input
                      {...control}
                      type="text"
                      autoComplete="address-level2"
                      placeholder="City"
                      value={form.city}
                      onChange={setField("city")}
                    />
                  )}
                </Field>
                <Field label="Street address" required error={errors.street}>
                  {(control) => (
                    <Input
                      {...control}
                      type="text"
                      autoComplete="street-address"
                      placeholder="Street address"
                      value={form.street}
                      onChange={setField("street")}
                    />
                  )}
                </Field>
                <Field label="Apartment, suite, etc." hint="Optional">
                  {(control) => (
                    <Input
                      {...control}
                      type="text"
                      autoComplete="address-line2"
                      placeholder="Apartment, suite, etc. (optional)"
                      value={form.apartment}
                      onChange={setField("apartment")}
                    />
                  )}
                </Field>
                <Field label="Postal code" hint="Optional">
                  {(control) => (
                    <Input
                      {...control}
                      type="text"
                      autoComplete="postal-code"
                      placeholder="Postal code"
                      value={form.postalCode}
                      onChange={setField("postalCode")}
                    />
                  )}
                </Field>
              </CardBody>
            </Card>
          </div>

          {/* Order summary */}
          <Card className="overflow-hidden border-t-2 border-primary-500">
            <CardHeader title="Order Summary" />
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
                <span className="font-semibold text-ink">Free</span>
              </div>

              <div className="my-2 border-t border-dashed border-line" />

              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-ink">Total:</span>
                <span className="font-mono text-xl font-bold text-primary-600">{formatPrice(subtotal)}</span>
              </div>

              <fieldset className="mt-2 flex flex-col gap-2">
                <legend className="mb-1 text-sm font-bold text-ink">Payment Method</legend>
                {PAYMENT_METHODS.map(({ value, icon: Icon }) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-3 rounded-control border border-line px-3 py-2.5 text-sm transition hover:border-primary-500 hover:bg-surface-alt focus-within:outline-2 focus-within:outline-primary-500"
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={value}
                      checked={payment === value}
                      onChange={() => setPayment(value)}
                      className="size-4 accent-primary-600"
                    />
                    <Icon className={cn("size-4 text-muted", payment === value && "text-primary-600")} aria-hidden="true" />
                    <span
                      className={cn("text-xs font-semibold uppercase tracking-wide", payment === value ? "text-ink" : "text-muted")}
                    >
                      {value}
                    </span>
                  </label>
                ))}
              </fieldset>

              {orderError && (
                <p className="text-xs font-medium text-danger-600" role="alert">
                  {orderError}
                </p>
              )}

              <Button
                type="submit"
                fullWidth
                className="mt-2"
                loading={placeOrder.isPending}
                leftIcon={<Wallet className="size-4" aria-hidden="true" />}
              >
                Place order
              </Button>

              <Link
                to="/cart"
                className="text-center text-xs font-semibold text-muted underline-offset-4 transition hover:text-ink hover:underline"
              >
                ← Back to cart
              </Link>
            </CardBody>
          </Card>
        </form>
      </div>
    </div>
  );
}
