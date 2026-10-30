import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Search, X } from "lucide-react";
import { Button, Input, Pagination, Select, StatusBadge } from "../../components/ui";
import { Card, CardBody } from "../../components/ui/Card";
import { useProductCategories, useProducts } from "../../hooks/useProducts";
import { cn } from "../../lib/cn";
import { formatPrice } from "../../lib/format";
import { STOCK_STATUSES } from "../../types/inventory";
import type { ProductSortField, StockStatus } from "../../types/inventory";
import { PAGE_SIZES } from "../../page/Products/productQuery";
import { useProductFilters } from "../../page/Products/useProductFilters";

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

/**
 * Read-only private product catalogue for STAFF. It deliberately has no
 * create/edit/delete controls and never renders cost price (the data layer
 * strips it for non-ADMIN roles).
 */
export default function StaffProducts({ basePath = "/staff" }: { basePath?: string }) {
  const { query, update, clearFilters, hasFilters } = useProductFilters();
  const { data, isPending, isError, refetch, isPlaceholderData } = useProducts(query);
  const categories = useProductCategories();

  const [searchText, setSearchText] = useState(query.search);
  const [seenUrlSearch, setSeenUrlSearch] = useState(query.search);

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

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  useEffect(() => {
    if (data && !isPlaceholderData && total > 0 && query.page > pageCount) {
      update({ page: pageCount }, { replace: true });
    }
  }, [data, isPlaceholderData, total, query.page, pageCount, update]);

  const sortValue = query.sortBy ? `${query.sortBy}-${query.sortDir}` : "";
  const handleSortChange = (value: string) => {
    if (!value) return update({ sortBy: null, sortDir: "asc" });
    const separator = value.lastIndexOf("-");
    update({
      sortBy: value.slice(0, separator) as ProductSortField,
      sortDir: value.endsWith("-desc") ? "desc" : "asc",
    });
  };

  const from = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const to = Math.min(query.page * query.pageSize, total);
  const products = data?.items ?? [];

  return (
    <div className="text-ink">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111827]">Products</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Read-only product catalogue</p>
        </div>
      </div>

      <Card className="mt-6">
        <CardBody className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
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
            {(categories.data ?? []).map((c) => (
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
          <Select aria-label="Sort products" value={sortValue} onChange={(e) => handleSortChange(e.target.value)} wrapperClassName="md:w-52">
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <Button variant="ghost" onClick={() => { setSearchText(""); clearFilters(); }} leftIcon={<X className="size-4" aria-hidden="true" />}>
              Clear filters
            </Button>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {isPending ? (
          <p role="status" className="p-10 text-center text-sm text-[#6B7280]">
            Loading products…
          </p>
        ) : isError ? (
          <div role="alert" className="p-10 text-center text-sm">
            <p className="text-[#DC2626]">Couldn’t load products.</p>
            <button type="button" onClick={() => void refetch()} className="mt-2 font-semibold text-[#FF5615] hover:underline">
              Try again
            </button>
          </div>
        ) : products.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#6B7280]">{hasFilters ? "No products match these filters." : "No products yet."}</p>
        ) : (
          <div className={cn("overflow-x-auto transition-opacity", isPlaceholderData && "opacity-60")} aria-busy={isPlaceholderData}>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#F8F8F8] text-xs font-semibold text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-3 font-semibold text-[#111827]">{product.name}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{product.sku}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{product.category || "—"}</td>
                    <td className="px-4 py-3 text-right text-[#111827]">{formatPrice(product.price)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#111827]">{product.stock}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          to={`${basePath}/products/${product.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#FF5615] hover:bg-[#FFF3EC]"
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isPending && !isError && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F3F4F6] px-4 py-3">
            <p className="text-xs text-[#6B7280]">
              Showing {from}–{to} of {total} {total === 1 ? "product" : "products"}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                aria-label="Products per page"
                value={String(query.pageSize)}
                onChange={(e) => update({ pageSize: Number(e.target.value), page: 1 })}
                wrapperClassName="w-40"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </Select>
              {pageCount > 1 && <Pagination page={query.page} totalPages={pageCount} onChange={(page) => update({ page })} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
