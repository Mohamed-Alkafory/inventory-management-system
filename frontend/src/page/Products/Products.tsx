import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { OnChangeFn, PaginationState, SortingState } from "@tanstack/react-table";
import { Eye, Package, Pencil, Plus, Search, X } from "lucide-react";
import { ApiError } from "../../api/errors";
import { Button, DataTable, EmptyState, Input, Modal, Select, StatusBadge } from "../../components/ui";
import type { DataTableColumn } from "../../components/ui";
import { Card, CardBody } from "../../components/ui/Card";
import { useToast } from "../../components/ui/toast/useToast";
import { useAuth } from "../../context/auth/useAuth";
import { useProductCategories, useProducts } from "../../hooks/useProducts";
import { cn } from "../../lib/cn";
import { formatPrice } from "../../lib/format";
import { STOCK_STATUSES } from "../../types/inventory";
import type { InventoryProduct, ProductSortField, StockStatus } from "../../types/inventory";
import { PAGE_SIZES } from "./productQuery";
import { useProductFilters } from "./useProductFilters";

const STOCK_LABELS: Record<StockStatus, string> = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
};

const SEARCH_DEBOUNCE_MS = 300;

/** Product picture; falls back to an icon when there is no image or it fails to load. */
function ProductThumb({ product }: { product: InventoryProduct }) {
  const [failed, setFailed] = useState(false);

  if (!product.imageUrl || failed) {
    return (
      <div className="flex size-10 items-center justify-center rounded-control bg-slate-100 text-slate-400" aria-hidden="true">
        <Package className="size-5" />
      </div>
    );
  }
  return (
    <img
      src={product.imageUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-10 rounded-control bg-slate-100 object-cover"
    />
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

export default function Products() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const isAdmin = hasRole("ADMIN");

  const { query, update, clearFilters, hasFilters } = useProductFilters();

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useProducts(query);
  const categories = useProductCategories();

  const [viewing, setViewing] = useState<InventoryProduct | null>(null);

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

  /* ---------- Paging / sorting wiring for the DataTable ---------- */
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  // Asked for a page past the end (e.g. a stale link): jump to the last one.
  useEffect(() => {
    if (data && !isPlaceholderData && total > 0 && query.page > pageCount) {
      update({ page: pageCount }, { replace: true });
    }
  }, [data, isPlaceholderData, total, query.page, pageCount, update]);

  const sorting = useMemo<SortingState>(
    () => (query.sortBy ? [{ id: query.sortBy, desc: query.sortDir === "desc" }] : []),
    [query.sortBy, query.sortDir],
  );

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: query.page - 1, pageSize: query.pageSize }),
    [query.page, query.pageSize],
  );

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    const first = next[0];
    if (first) update({ sortBy: first.id as ProductSortField, sortDir: first.desc ? "desc" : "asc" });
    else update({ sortBy: null, sortDir: "asc" });
  };

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = typeof updater === "function" ? updater(pagination) : updater;
    if (next.pageSize !== pagination.pageSize) update({ pageSize: next.pageSize });
    else update({ page: next.pageIndex + 1 });
  };

  /* ---------- Columns ---------- */
  const columns = useMemo<DataTableColumn<InventoryProduct>[]>(() => {
    const cols: DataTableColumn<InventoryProduct>[] = [
      {
        id: "image",
        header: () => <span className="sr-only">Image</span>,
        enableSorting: false,
        cell: ({ row }) => <ProductThumb product={row.original} />,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => <span className="font-mono text-xs text-muted">{row.original.sku}</span>,
      },
      { accessorKey: "category", header: "Category", enableSorting: false },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => <span className="whitespace-nowrap">{formatPrice(row.original.price)}</span>,
      },
    ];

    // Cost price is internal: only ADMIN gets the column.
    if (isAdmin) {
      cols.push({
        accessorKey: "costPrice",
        header: "Cost price",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted">
            {row.original.costPrice === undefined ? "—" : formatPrice(row.original.costPrice)}
          </span>
        ),
      });
    }

    cols.push(
      { accessorKey: "stock", header: "Stock" },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    );
    return cols;
  }, [isAdmin]);

  const rowActions = useCallback(
    (product: InventoryProduct) => (
      <>
        <Button size="sm" variant="ghost" aria-label={`View ${product.name}`} onClick={() => setViewing(product)}>
          <Eye className="size-4" aria-hidden="true" />
        </Button>
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Edit ${product.name}`}
            onClick={() => toast.info("Edit product", "The edit form is coming soon.")}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
        )}
      </>
    ),
    [isAdmin, toast],
  );

  const addProduct = () => toast.info("Add product", "The product form is coming soon.");

  const errorMessage = isError ? (error instanceof ApiError ? error.message : "Couldn’t load the products.") : null;

  // A category that is in the URL but not (yet) in the loaded list must still show as selected.
  const categoryOptions = categories.data ?? [];
  const showExtraCategory = Boolean(query.category) && !categoryOptions.some((c) => c.id === query.category);

  return (
    <main className="min-h-[calc(100vh-72px)] bg-surface-alt py-10 text-ink">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
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

            {hasFilters && (
              <Button variant="ghost" onClick={handleClear} leftIcon={<X className="size-4" aria-hidden="true" />}>
                Clear filters
              </Button>
            )}
          </CardBody>
        </Card>

        <div aria-busy={isPlaceholderData} className={cn("mt-4 transition-opacity", isPlaceholderData && "opacity-60")}>
          <DataTable<InventoryProduct>
            caption="Products"
            columns={columns}
            data={data?.items ?? []}
            getRowId={(row) => row.id}
            rowActions={rowActions}
            loading={isPending}
            error={errorMessage}
            onRetry={() => void refetch()}
            empty={
              hasFilters ? (
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
                  description={isAdmin ? "Add your first product to start tracking stock." : "Products will show up here once an admin adds them."}
                  action={isAdmin ? <Button onClick={addProduct}>Add Product</Button> : undefined}
                />
              )
            }
            pageSize={query.pageSize}
            pageSizeOptions={PAGE_SIZES}
            pageCount={pageCount}
            totalRows={total}
            pagination={pagination}
            onPaginationChange={handlePaginationChange}
            sorting={sorting}
            onSortingChange={handleSortingChange}
          />
        </div>
      </div>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? "Product"}
        description={viewing ? `SKU ${viewing.sku}` : undefined}
        footer={
          <Button variant="secondary" onClick={() => setViewing(null)}>
            Close
          </Button>
        }
      >
        {viewing && (
          <dl className="grid grid-cols-2 gap-4">
            <Detail label="Category">{viewing.category}</Detail>
            <Detail label="Status">
              <StatusBadge status={viewing.status} />
            </Detail>
            <Detail label="Price">{formatPrice(viewing.price)}</Detail>
            {isAdmin && (
              <Detail label="Cost price">
                {viewing.costPrice === undefined ? "—" : formatPrice(viewing.costPrice)}
              </Detail>
            )}
            <Detail label="In stock">{viewing.stock}</Detail>
            <Detail label="Reorder level">{viewing.reorderLevel}</Detail>
          </dl>
        )}
      </Modal>
    </main>
  );
}
