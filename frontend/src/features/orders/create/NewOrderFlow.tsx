import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "../../../lib/http";
import { STAFF_ORDERS_PATH, orderPath } from "../format";
import { USE_MOCK } from "./api";
import { useCreateOrder } from "./hooks";
import OrderBuilder from "./OrderBuilder";
import OrderSummary from "./OrderSummary";
import { extractStockFailures } from "./stock";
import type { CustomerFormValues } from "./schema";
import type { DraftLine, Id, PickerProduct, StockFailure } from "./types";

type Step = "build" | "summary";
type ServerErrors = Partial<Record<keyof CustomerFormValues, string>>;

/** API field name → form field name. Add your server's names here if they differ. */
const ALIASES: Record<string, keyof CustomerFormValues> = {
  name: "name",
  customerName: "name",
  customer_name: "name",
  phone: "phone",
  customerPhone: "phone",
  customer_phone: "phone",
  notes: "notes",
  note: "notes",
};

/** Shared order builder; the admin area mounts it under its own base path. */
export default function NewOrderFlow({ basePath = STAFF_ORDERS_PATH }: { basePath?: string }) {
  const navigate = useNavigate();
  const create = useCreateOrder();

  const [step, setStep] = useState<Step>("build");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [customer, setCustomer] = useState<CustomerFormValues>({ name: "", phone: "", notes: "" });
  const [failures, setFailures] = useState<StockFailure[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<ServerErrors>({});
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const clearFailure = (id: Id) => setFailures((fs) => fs.filter((f) => String(f.productId) !== String(id)));

  const add = (p: PickerProduct) =>
    setLines((ls) => {
      const existing = ls.find((l) => l.product.id === p.id);
      if (!existing) return [...ls, { product: p, quantity: 1 }];
      const max = existing.product.stock ?? Infinity;
      return ls.map((l) => (l.product.id === p.id ? { ...l, quantity: Math.min(l.quantity + 1, max) } : l));
    });

  const setQuantity = (id: Id, quantity: number) => {
    clearFailure(id);
    setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, quantity } : l)));
  };

  const remove = (id: Id) => {
    clearFailure(id);
    setLines((ls) => ls.filter((l) => l.product.id !== id));
  };

  /** Fresh stock numbers from the picker keep the lines already in the order up to date. */
  const refreshStock = useCallback((fresh: PickerProduct[]) => {
    setLines((ls) => {
      let changed = false;
      const next = ls.map((l) => {
        const f = fresh.find((p) => p.id === l.product.id);
        if (!f || f.stock === l.product.stock) return l;
        changed = true;
        return { ...l, product: { ...l.product, stock: f.stock } };
      });
      return changed ? next : ls;
    });
  }, []);

  const place = async () => {
    setSummaryError(null);
    setBanner(null);
    try {
      const created = await create.mutateAsync({
        customer: { name: customer.name, phone: customer.phone },
        notes: customer.notes,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      });
      navigate(created.id !== null ? orderPath(created.id, basePath) : basePath, { replace: true });
    } catch (err) {
      if (!(err instanceof ApiError)) return setSummaryError("Something went wrong. Please try again.");

      if (err.status === 409) {
        // Insufficient stock → go back to the items and say exactly which products failed.
        const found = extractStockFailures(err.body);
        if (found.length > 0) {
          setFailures(found);
          setLines((ls) =>
            ls.map((l) => {
              const f = found.find((x) => String(x.productId) === String(l.product.id) || (!x.productId && x.sku && x.sku === l.product.sku));
              return f && f.available !== null ? { ...l, product: { ...l.product, stock: f.available } } : l;
            }),
          );
          setBanner(err.serverMessage ?? "Some products don’t have enough stock for the quantities you chose.");
          return setStep("build");
        }
        return setSummaryError(err.message);
      }

      // Validation errors on the customer fields → back to the form, message under the field.
      const fieldErrors: ServerErrors = {};
      for (const [k, msg] of Object.entries(err.fieldErrors)) {
        const f = ALIASES[k];
        if (f && !fieldErrors[f]) fieldErrors[f] = msg;
      }
      if (Object.keys(fieldErrors).length > 0) {
        setServerErrors(fieldErrors);
        return setStep("build");
      }
      setSummaryError(err.message);
    }
  };

  return (
    <div>
      <Link to={basePath} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] hover:text-[#FF5615]">
        <ArrowLeft className="h-4 w-4" />
        Back to orders
      </Link>

      <h1 className="mt-4 text-2xl font-extrabold text-[#111827]">New order</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Build an order from products in stock</p>
      {USE_MOCK && (
        <p className="mt-2 inline-block rounded-full bg-[#FFF1EB] px-2.5 py-1 text-[11px] font-semibold text-[#FF5615]">Demo data (mock API)</p>
      )}

      <ol className="mt-6 flex items-center gap-3 text-sm font-semibold" aria-label="Steps">
        {([["build", "1  Items & customer"], ["summary", "2  Summary"]] as const).map(([id, label], i) => (
          <li key={id} aria-current={step === id ? "step" : undefined} className="flex items-center gap-3">
            {i > 0 && <span aria-hidden="true" className="h-px w-8 bg-[#D1D5DB]" />}
            <span className={step === id ? "rounded-full bg-[#FF5615] px-3 py-1 text-white" : "rounded-full bg-[#F3F4F6] px-3 py-1 text-[#6B7280]"}>{label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {step === "build" ? (
          <OrderBuilder
            lines={lines}
            customer={customer}
            failures={failures}
            banner={banner}
            serverErrors={serverErrors}
            onAdd={add}
            onFresh={refreshStock}
            onQuantity={setQuantity}
            onRemove={remove}
            onReview={(values) => {
              setCustomer(values);
              setServerErrors({});
              setBanner(null);
              setSummaryError(null);
              setStep("summary");
            }}
          />
        ) : (
          <OrderSummary lines={lines} customer={customer} placing={create.isPending} error={summaryError} onBack={() => setStep("build")} onPlace={place} />
        )}
      </div>
    </div>
  );
}
