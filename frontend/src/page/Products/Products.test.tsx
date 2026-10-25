import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/errors";
import { tokenStorage } from "../../api/tokenStorage";
import ToastProvider from "../../components/ui/toast/ToastProvider";
import AuthProvider from "../../context/auth/AuthProvider";
import type { InventoryProduct, ProductQuery } from "../../types/inventory";
import type { Role } from "../../types/auth";
import Products from "./Products";

const list = vi.hoisted(() => vi.fn());

vi.mock("../../api/authApi", () => ({
  authApi: { login: vi.fn(), logout: vi.fn().mockResolvedValue(undefined), me: vi.fn().mockImplementation(() => new Promise(() => {})) },
}));
vi.mock("../../api/productsApi", () => ({
  productsApi: { list, categories: vi.fn().mockResolvedValue([{ id: "c1", name: "Accessories" }, { id: "c2", name: "Audio" }]) },
}));

const product = (over: Partial<InventoryProduct> = {}): InventoryProduct => ({
  id: "1",
  name: "Wireless Mouse",
  sku: "WM-204",
  categoryId: "c1",
  category: "Accessories",
  price: 450,
  costPrice: 280,
  stock: 142,
  reorderLevel: 40,
  status: "in_stock",
  ...over,
});

const signIn = (role: Role) =>
  tokenStorage.setSession({
    accessToken: "t",
    refreshToken: "r",
    user: { id: "1", name: "Test User", email: "test@prodexa.com", role },
  });

function renderPage(url = "/products") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <AuthProvider>
            <Products />
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  tokenStorage.clear();
  list.mockReset();
  list.mockResolvedValue({ items: [product()], total: 1 });
});
afterEach(cleanup);

describe("Products page", () => {
  it("shows the table, the cost price column and Add Product for ADMIN", async () => {
    signIn("ADMIN");
    renderPage();

    expect(await screen.findByText("Wireless Mouse")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /cost price/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add product/i })).toBeInTheDocument();
  });

  it("hides cost price and Add Product from STAFF", async () => {
    signIn("STAFF");
    renderPage();

    expect(await screen.findByText("Wireless Mouse")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /cost price/i })).not.toBeInTheDocument();
    expect(screen.queryByText("280 EGP")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add product/i })).not.toBeInTheDocument();
  });

  it("reads the filters from the URL and sends them to the API", async () => {
    signIn("ADMIN");
    renderPage("/products?q=mouse&category=c2&stock=low_stock&sort=price&dir=desc&page=1&size=20");

    await screen.findByText("Wireless Mouse");
    const query = list.mock.calls[0][0] as ProductQuery;
    expect(query).toMatchObject({
      search: "mouse",
      category: "c2",
      status: "low_stock",
      sortBy: "price",
      sortDir: "desc",
      pageSize: 20,
    });
    expect(screen.getByRole("searchbox", { name: /search products/i })).toHaveValue("mouse");
  });

  it("combines filters: changing the category keeps the search", async () => {
    signIn("ADMIN");
    renderPage("/products?q=mouse");
    await screen.findByText("Wireless Mouse");
    await screen.findByRole("option", { name: "Audio" });

    fireEvent.change(screen.getByLabelText(/filter by category/i), { target: { value: "c2" } });

    await waitFor(() => {
      const last = list.mock.calls[list.mock.calls.length - 1][0] as ProductQuery;
      expect(last).toMatchObject({ search: "mouse", category: "c2", page: 1 });
    });
  });

  it("shows the empty state with a way to clear the filters", async () => {
    signIn("ADMIN");
    list.mockResolvedValue({ items: [], total: 0 });
    renderPage("/products?q=zzz");

    expect(await screen.findByText(/no products match your filters/i)).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
  });

  it("shows the error state and retries", async () => {
    signIn("ADMIN");
    list.mockRejectedValueOnce(new ApiError("Boom from the server.", { status: 500 }));
    renderPage();

    expect(await screen.findByText("Boom from the server.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Wireless Mouse")).toBeInTheDocument();
  });
});
