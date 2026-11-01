import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Boxes, CircleCheck, Package } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, Skeleton, SkeletonText, StatusBadge } from "../../components/ui";
import { useProduct } from "../../hooks/useProducts";
import { resolveImageUrl } from "../../lib/imageUrl";
import { formatPrice } from "../../lib/format";

/** Small labelled stat cell in the stock summary card. */
function StatTile({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-3 text-center">
      <span className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        {icon}
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={valueClassName ?? "text-lg font-bold text-ink"}>{value}</p>
    </div>
  );
}

/**
 * Read-only staff product detail from the private products API.
 * No edit/delete actions and no cost price (stripped for non-ADMIN roles).
 */
export default function StaffProductDetails({ basePath = "/staff" }: { basePath?: string }) {
  const { id = "" } = useParams();
  const { data: product, isPending, isError, refetch } = useProduct(id);

  if (isPending) {
    return (
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <Skeleton className="aspect-[4/3] rounded-none" />
        </Card>
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-32" />
          <SkeletonText lines={3} />
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <EmptyState
        icon={<Package className="size-6" aria-hidden="true" />}
        title="Product not found"
        description="It may have been removed, or the link is wrong."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-alt"
            >
              Try again
            </button>
            <Link
              to={`${basePath}/products`}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              All products
            </Link>
          </div>
        }
      />
    );
  }

  const imageSrc = resolveImageUrl(product.imageUrl);
  const inactive = product.isActive === false;
  const outOfStock = product.stock <= 0;

  return (
    <div className="text-ink">
      <Link
        to={`${basePath}/products`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-primary-600"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All products
      </Link>

      <div className="mt-5 grid items-start gap-8 lg:grid-cols-2">
        {/* Picture */}
        <div className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          <Card className="overflow-hidden">
            <div className="relative aspect-[4/3] bg-primary-50">
              {imageSrc ? (
                <img src={imageSrc} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl font-bold text-primary-600">
                  {product.name.charAt(0)}
                </div>
              )}
              <div className="pointer-events-none absolute left-4 top-4">
                <StatusBadge status={product.status} />
              </div>
            </div>
          </Card>
        </div>

        {/* Info */}
        <div>
          <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700">
            {product.category || "Uncategorised"}
          </span>

          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">{product.name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="rounded-control border border-line bg-surface px-2.5 py-1 font-medium">
              SKU {product.sku}
            </span>
            {product.barcode && (
              <span className="rounded-control border border-line bg-surface px-2.5 py-1 font-medium">
                Barcode {product.barcode}
              </span>
            )}
          </div>

          <p className="mt-5 text-4xl font-extrabold tracking-tight text-ink">{formatPrice(product.price)}</p>

          <Card className="mt-6">
            <CardHeader title="Stock overview" description="Live inventory for this product." />
            <CardBody className="p-0">
              <div className="grid grid-cols-3 divide-x divide-line">
                <StatTile
                  icon={<Boxes className="size-4" aria-hidden="true" />}
                  label="In stock"
                  value={product.stock}
                  valueClassName={outOfStock ? "text-lg font-bold text-danger-600" : "text-lg font-bold text-ink"}
                />
                <StatTile
                  icon={<AlertTriangle className="size-4" aria-hidden="true" />}
                  label="Reorder point"
                  value={product.reorderLevel}
                />
                <StatTile
                  icon={<CircleCheck className="size-4" aria-hidden="true" />}
                  label="Status"
                  value={inactive ? "Inactive" : "Active"}
                  valueClassName={inactive ? "text-lg font-bold text-danger-600" : "text-lg font-bold text-success-700"}
                />
              </div>
            </CardBody>
          </Card>

          <div className="mt-6 rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="text-base font-bold text-ink">Description</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
              {product.description?.trim() || "No description yet."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
