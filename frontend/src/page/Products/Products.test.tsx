import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/http";
import ToastProvider from "../../components/ui/toast/ToastProvider";
import CartProvider from "../../context/cart/CartProvider";
import FavoritesProvider from "../../context/favorites/FavoritesProvider";
import type { CatalogQuery, ShopProduct } from "../../types/shop";
import ShopProducts from "./ShopProducts";

const list = vi.hoisted(() => vi.fn());
const categories = vi.hoisted(() => vi.fn());

vi.mock("../../api/catalogApi", () => ({
  catalogApi: { list, categories, get: vi.fn() },
}));

const product = (over: Partial<ShopProduct> = {}): ShopProduct => ({
  id: "p-1",
  name: "Wireless Mouse",
  description: "A comfortable wireless mouse.",
  price: 450,
  category: "Accessories",
  categoryId: "c1",
  inStock: true,
  maxOrderable: 10,
  ...over,
});

function renderPage(url = "/products") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <CartProvider>
            <FavoritesProvider>
              <ShopProducts />
            </FavoritesProvider>
          </CartProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  list.mockReset();
  categories.mockReset();
  list.mockResolvedValue({ items: [product()], total: 1, totalPages: 1, page: 1 });
  categories.mockResolvedValue([
    { id: "c1", name: "Accessories" },
    { id: "c2", name: "Audio" },
  ]);
});
afterEach(cleanup);

describe("public products page", () => {
  it("browses anonymously and shows only customer-safe fields", async () => {
    renderPage();

    expect(await screen.findByText("Wireless Mouse")).toBeInTheDocument();
    expect(screen.getByText("450 EGP")).toBeInTheDocument();
    expect(screen.getAllByText("In stock").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^order$/i })).toBeInTheDocument();
    expect(screen.queryByText(/sku/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add product/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/cost/i)).not.toBeInTheDocument();
  });

  it("reads filters and sends them to the public catalog API", async () => {
    renderPage("/products?q=mouse&category=c2&sort=price&dir=desc&page=1&size=20");

    await screen.findByText("Wireless Mouse");
    const query = list.mock.calls[0][0] as CatalogQuery;
    expect(query).toMatchObject({
      search: "mouse",
      category: "c2",
      sort: "price",
      order: "desc",
      pageSize: 20,
    });
    expect(screen.getByRole("searchbox", { name: /search products/i })).toHaveValue("mouse");
  });

  it("disables ordering when a product is out of stock", async () => {
    list.mockResolvedValue({
      items: [product({ inStock: false, maxOrderable: 0 })],
      total: 1,
      totalPages: 1,
      page: 1,
    });
    renderPage();

    expect(await screen.findByText("Wireless Mouse")).toBeInTheDocument();
    expect(screen.getAllByText("Out of stock").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /out of stock/i })).toBeDisabled();
  });

  it("shows the empty state with a way to clear the filters", async () => {
    list.mockResolvedValue({ items: [], total: 0, totalPages: 1, page: 1 });
    renderPage("/products?q=zzz");

    expect(await screen.findByText(/no products match your filters/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /clear filters/i }).length).toBeGreaterThan(0);
  });

  it("handles the public rate limit with a friendly retry", async () => {
    list.mockRejectedValueOnce(new ApiError(429, "Too many requests. Please slow down and try again."));
    renderPage();

    expect(await screen.findByText(/try again in a moment/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Wireless Mouse")).toBeInTheDocument();
  });

  it("uses the response meta for pagination", async () => {
    list.mockResolvedValue({ items: [product()], total: 25, totalPages: 3, page: 1 });
    renderPage();

    await screen.findByText("Wireless Mouse");
    expect(screen.getByText(/showing 1–10 of 25 products/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });
});
