import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Package } from "lucide-react";
import { Card, CardBody, EmptyState, Skeleton, SkeletonText, StatusBadge } from "../../components/ui";
import { useProduct } from "../../hooks/useProducts";
import { resolveImageUrl } from "../../lib/imageUrl";
import { formatPrice } from "../../lib/format";

/**
 * Read-only staff product detail from the private products API.
 * No edit/delete actions and no cost price (stripped for non-ADMIN roles).
 */
export default function StaffProductDetails({ basePath = "/staff" }: { basePath?: string }) {
  const { id = "" } = useParams();
  const { data: product, isPending, isError, refetch } = useProduct(id);

  if (isPending) {
    return (
      <Card className="overflow-hidden">
        <CardBody className="space-y-4 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-2/3" />
          <SkeletonText lines={3} />
        </CardBody>
      </Card>
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
            <button type="button" onClick={() => void refetch()} className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]">
              Try again
            </button>
            <Link to={`${basePath}/products`} className="rounded-lg bg-[#FF5615] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E84A0E]">
              All products
            </Link>
          </div>
        }
      />
    );
  }

  const imageSrc = resolveImageUrl(product.imageUrl);

  return (
    <div className="text-ink">
      <Link to={`${basePath}/products`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] hover:text-[#FF5615]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All products
      </Link>

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="aspect-[4/3] bg-[#FFF1EB]">
            {imageSrc ? (
              <img src={imageSrc} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl font-bold text-[#FF5615]">{product.name.charAt(0)}</div>
            )}
          </div>
        </Card>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{product.category || "Uncategorised"}</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-[#111827]">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={product.status} />
            <span className="text-sm text-[#6B7280]">SKU {product.sku}</span>
            {product.barcode && <span className="text-sm text-[#6B7280]">Barcode {product.barcode}</span>}
          </div>

          <p className="mt-4 text-3xl font-bold text-[#111827]">{formatPrice(product.price)}</p>

          <Card className="mt-6">
            <CardBody className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">In stock</p>
                <p className="mt-0.5 text-lg font-bold text-[#111827]">{product.stock}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Reorder point</p>
                <p className="mt-0.5 text-lg font-bold text-[#111827]">{product.reorderLevel}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Status</p>
                <p className="mt-0.5 text-sm font-semibold text-[#374151]">{product.isActive === false ? "Inactive" : "Active"}</p>
              </div>
            </CardBody>
          </Card>

          <div className="mt-6 border-t border-[#E5E7EB] pt-6">
            <h2 className="text-base font-bold text-[#111827]">Description</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#6B7280]">{product.description?.trim() || "No description yet."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
