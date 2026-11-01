import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/errors";
import { Button, EmptyState, Input, Pagination, Select } from "../../components/ui";
import { Card, CardBody } from "../../components/ui/Card";
import { AdminProductCard, AdminProductCardSkeleton } from "../../admin/components/AdminProductCard";
import { useAuth } from "../../context/auth/useAuth";
import DeleteProductDialog from "../../features/products/DeleteProductDialog";
import ProductFormDialog from "../../features/products/ProductFormDialog";
import type { Product } from "../../features/products/types";
import { useProductCategories, useProducts } from "../../hooks/useProducts";
import { cn } from "../../lib/cn";
import { useArea } from "../../routes/useArea";
import { STOCK_STATUSES } from "../../types/inventory";
import type { InventoryProduct, ProductSortField, StockStatus } from "../../types/inventory";
import { PAGE_SIZES } from "./productQuery";
import { useProductFilters } from "./useProductFilters";

const STOCK_LABELS: Record<StockStatus, string> = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
};

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Default order" },
  { value: "name-asc", label: "Name A → Z" },
  { value: "name-desc", label: "Name Z → A" },
  { value: "price-asc", label: "Price low → high" },
  { value: "price-desc", label: "Price high → low" },
  { value: "stock-asc", label: "Stock low → high" },
  { value: "stock-desc", label: "Stock high → low" },
];

const SEARCH_DEBOUNCE_MS = 300;

/** The list row carries everything the edit form needs except the supplier/barcode extras. */
function toFormProduct(product: InventoryProduct): Product {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    price: product.price,
    costPrice: product.costPrice,
    categoryId: product.categoryId,
    supplierId: product.supplierId,
    barcode: product.barcode,
    minStock: product.reorderLevel,
    imageUrl: product.imageUrl,
    isActive: product.isActive ?? true,
  };
}

export default function Products({ embedded = false }: { embedded?: boolean }) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN");
  const navigate = useNavigate();
  // Stay inside the dashboard shell the list is rendered in (admin/staff/support).
  const area = useArea();
  const detailBase =
    area === "admin"
      ? "/admin/products"
      : area === "staff"
        ? "/staff/products"
        : area === "support"
          ? "/support/products"
          : area === "customer"
            ? "/dashboard/products"
            : "/products";

  const { query, update, clearFilters, hasFilters } = useProductFilters();

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useProducts(query);
  const categories = useProductCategories();

  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; product: InventoryProduct } | null>(null);
  const [toDelete, setToDelete] = useState<InventoryProduct | null>(null);

  /* ---------- Search box: typing is debounced into the URL ---------- */
  const [searchText, setSearchText] = useState(query.search);
  const [seenUrlSearch, setSeenUrlSearch] = useState(query.search);

  // The URL changed from outside (back button, link): show it in the box.
  if (query.search !== seenUrlSearch) {
    setSeenUrlSearch(query.search);
    if (searchText.trim() !== query.search) setSearchText(query.search);
  }

  useEffect(() => {
    const next = searchText.trim();
    if (next === query.search) return;
    const timer = setTimeout(() => update({ search: next }, { replace: true }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, query.search, update]);

  const handleClear = () => {
    setSearchText("");
    clearFilters();
  };

  /* ---------- Sorting / paging driven by the URL ---------- */
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  // Asked for a page past the end (e.g. a stale link): jump to the last one.
  useEffect(() => {
    if (data && !isPlaceholderData && total > 0 && query.page > pageCount) {
      update({ page: pageCount }, { replace: true });
    }
  }, [data, isPlaceholderData, total, query.page, pageCount, update]);

  const sortValue = query.sortBy ? `${query.sortBy}-${query.sortDir}` : "";
  const handleSortChange = (value: string) => {
    if (!value) {
      update({ sortBy: null, sortDir: "asc" });
      return;
    }
    const separator = value.lastIndexOf("-");
    update({
      sortBy: value.slice(0, separator) as ProductSortField,
      sortDir: value.endsWith("-desc") ? "desc" : "asc",
    });
  };

  const handlePageChange = (page: number) => update({ page });

  const from = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const to = Math.min(query.page * query.pageSize, total);

  const products = data?.items ?? [];

  const addProduct = () => setDialog({ mode: "create" });

  const errorMessage = isError ? (error instanceof ApiError ? error.message : "Couldn't load the products.") : null;

  // A category that is in the URL but not (yet) in the loaded list must still show as selected.
  const categoryOptions = categories.data ?? [];
  const showExtraCategory = Boolean(query.category) && !categoryOptions.some((c) => c.id === query.category);

  return (
    <div className={embedded ? "text-ink" : "min-h-[calc(100vh_-_var(--header-h))] bg-surface-alt py-10 text-ink"}>
      <div className={embedded ? "mx-auto w-full max-w-7xl" : "mx-auto w-full max-w-7xl px-4 sm:px-6"}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Products</h1>
            <p className="mt-1 text-sm text-muted" aria-live="polite">
              {data ? `${total} ${total === 1 ? "product" : "products"}${hasFilters ? " found" : ""}` : "Loading products…"}
            </p>
          </div>
          {isAdmin && (
            <Button leftIcon={<Plus className="size-4" aria-hidden="true" />} onClick={addProduct}>
              Add Product
            </Button>
          )}
        </div>

        <Card className="mt-6">
          <CardBody className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                type="search"
                aria-label="Search products"
                placeholder="Search by name or SKU"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              aria-label="Filter by category"
              value={query.category}
              onChange={(e) => update({ category: e.target.value })}
              wrapperClassName="md:w-52"
            >
              <option value="">All categories</option>
              {showExtraCategory && <option value={query.category}>Selected category</option>}
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Filter by stock status"
              value={query.status}
              onChange={(e) => update({ status: e.target.value as StockStatus | "" })}
              wrapperClassName="md:w-48"
            >
              <option value="">All stock statuses</option>
              {STOCK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STOCK_LABELS[status]}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Sort products"
              value={sortValue}
              onChange={(e) => handleSortChange(e.target.value)}
              wrapperClassName="md:w-52"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            {hasFilters && (
              <Button variant="ghost" onClick={handleClear} leftIcon={<X className="size-4" aria-hidden="true" />}>
                Clear filters
              </Button>
            )}
          </CardBody>
        </Card>

        {errorMessage && (
          <div className="mt-4 flex flex-col gap-2 rounded-card border border-line bg-surface p-4" role="alert">
            <p className="text-sm font-medium text-danger-600">{errorMessage}</p>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        )}

        <div aria-busy={isPlaceholderData} className={cn("mt-4 transition-opacity", isPlaceholderData && "opacity-60")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {isPending
              ? Array.from({ length: 8 }, (_, i) => <AdminProductCardSkeleton key={i} />)
              : products.map((product) => (
                  <AdminProductCard
                    key={product.id}
                    product={product}
                    isAdmin={isAdmin}
                    disabled={isPlaceholderData}
                    onOpen={(product) => navigate(`${detailBase}/${product.id}`)}
                    onEdit={(product) => setDialog({ mode: "edit", product })}
                    onDelete={setToDelete}
                  />
                ))}
          </div>

          {!isPending && !errorMessage && products.length === 0 && (
            <div className="mt-4">
              {hasFilters ? (
                <EmptyState
                  title="No products match your filters"
                  description="Try a different search or clear the filters to see everything."
                  action={
                    <Button variant="secondary" onClick={handleClear}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="No products yet"
                  description={
                    isAdmin
                      ? "Add your first product to start tracking stock."
                      : "Products will show up here once an admin adds them."
                  }
                  action={isAdmin ? <Button onClick={addProduct}>Add Product</Button> : undefined}
                />
              )}
            </div>
          )}
        </div>

        {!isPending && !errorMessage && total > 0 && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted" aria-live="polite">
              Showing {from}–{to} of {total} {total === 1 ? "product" : "products"}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                aria-label="Products per page"
                value={String(query.pageSize)}
                onChange={(e) => update({ pageSize: Number(e.target.value), page: 1 })}
                wrapperClassName="w-44"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </Select>
              <Pagination page={query.page} totalPages={pageCount} onChange={handlePageChange} />
            </div>
          </div>
        )}
      </div>

      <ProductFormDialog
        open={dialog !== null}
        product={dialog?.mode === "edit" ? toFormProduct(dialog.product) : undefined}
        onClose={() => setDialog(null)}
      />

      <DeleteProductDialog product={toDelete ? toFormProduct(toDelete) : null} onClose={() => setToDelete(null)} />
    </div>
  );
}
