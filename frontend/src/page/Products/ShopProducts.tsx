import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, EmptyState, Input, Pagination, Select } from "../../components/ui";
import { Card, CardBody } from "../../components/ui/Card";
import { ProductCard, ProductCardSkeleton } from "../../components/shop/ProductCard";
import { useCart } from "../../context/cart/useCart";
import { useFavorites } from "../../context/favorites/useFavorites";
import { useCatalogCategories, useCatalogProducts } from "../../hooks/useCatalog";
import { cn } from "../../lib/cn";
import { useArea } from "../../routes/useArea";
import type { ShopProduct } from "../../types/shop";
import { catalogErrorMessage } from "./catalogError";
import { SHOP_PAGE_SIZES } from "./shopQuery";
import { useShopFilters } from "./useShopFilters";

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Newest first" },
  { value: "name-asc", label: "Name A → Z" },
  { value: "name-desc", label: "Name Z → A" },
  { value: "price-asc", label: "Price low → high" },
  { value: "price-desc", label: "Price high → low" },
];

const SEARCH_DEBOUNCE_MS = 300;

/** Public catalogue: no login required, customer-safe fields only. */
export default function ShopProducts() {
  const navigate = useNavigate();
  const cart = useCart();
  const favorites = useFavorites();
  // Inside a dashboard shell the layout owns the page background and padding,
  // and product/cart links stay in that shell.
  const area = useArea();
  const inArea = area !== null;
  const productBase = area === "customer" ? "/dashboard/products" : "/products";
  const cartPath = area === "customer" ? "/dashboard/cart" : "/cart";

  const { query, update, clearFilters, hasFilters } = useShopFilters();

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useCatalogProducts(query);
  const categories = useCatalogCategories();

  /* ---------- Search box: typing is debounced into the URL ---------- */
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

  const handleClear = () => {
    setSearchText("");
    clearFilters();
  };

  /* ---------- Sorting / paging driven by the URL and the response meta ---------- */
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, data?.totalPages ?? Math.ceil(total / query.pageSize));

  // Asked for a page past the end (e.g. a stale link): jump to the last one.
  useEffect(() => {
    if (data && !isPlaceholderData && total > 0 && query.page > pageCount) {
      update({ page: pageCount }, { replace: true });
    }
  }, [data, isPlaceholderData, total, query.page, pageCount, update]);

  const sortValue = query.sort === "newest" ? "" : `${query.sort}-${query.order}`;
  const handleSortChange = (value: string) => {
    if (!value) {
      update({ sort: "newest", order: "desc" });
      return;
    }
    const separator = value.lastIndexOf("-");
    update({
      sort: value.slice(0, separator) as "name" | "price",
      order: value.endsWith("-desc") ? "desc" : "asc",
    });
  };

  const from = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const to = Math.min(query.page * query.pageSize, total);
  const products = data?.items ?? [];

  const handleOrder = (product: ShopProduct) => {
    cart.addToCart(product);
    navigate(cartPath);
  };

  const errorMessage = isError ? catalogErrorMessage(error) : null;

  const categoryOptions = categories.data ?? [];
  const showExtraCategory = Boolean(query.category) && !categoryOptions.some((c) => c.id === query.category);

  return (
    <div className={inArea ? undefined : "min-h-[calc(100vh_-_var(--header-h))] bg-surface-alt py-10 text-ink"}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Products</h1>
            <p className="mt-1 text-sm text-muted" aria-live="polite">
              {data ? `${total} ${total === 1 ? "product" : "products"}${hasFilters ? " found" : ""}` : "Loading products…"}
            </p>
          </div>
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
                placeholder="Search products"
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
              ? Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)
              : products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isFavorite={favorites.has(product.id)}
                    disabled={isPlaceholderData}
                    onOpen={(product) => navigate(`${productBase}/${product.id}`)}
                    onOrder={handleOrder}
                    onToggleFavorite={favorites.toggle}
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
                  description="Products will show up here once the store adds them."
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
                {SHOP_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </Select>
              <Pagination page={query.page} totalPages={pageCount} onChange={(page) => update({ page })} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
