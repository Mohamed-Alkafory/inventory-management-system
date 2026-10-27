import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ToastProvider from "../../components/ui/toast/ToastProvider";
import CartProvider from "../../context/cart/CartProvider";
import type { InventoryProduct } from "../../types/inventory";
import Cart from "./Cart";

const product = (over: Partial<InventoryProduct> & { id: string }): InventoryProduct => ({
  name: `Product ${over.id}`,
  sku: `SKU-${over.id}`,
  categoryId: "c1",
  category: "Accessories",
  price: 450,
  stock: 10,
  reorderLevel: 0,
  status: "in_stock",
  ...over,
});

const seedCart = (items: Array<{ id: string; price: number; stock: number; quantity: number }>) => {
  localStorage.setItem(
    "prodexa.cart.v1",
    JSON.stringify(
      items.map(({ id, price, stock, quantity }) => ({ product: product({ id, price, stock }), quantity })),
    ),
  );
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/cart"]}>
          <CartProvider>
            <Cart />
          </CartProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Cart page", () => {
  it("shows the empty state with a way back to the products", () => {
    renderPage();

    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse products/i })).toBeInTheDocument();
  });

  it("lists the stored items with their quantity and the subtotal", () => {
    seedCart([
      { id: "1", price: 450, stock: 10, quantity: 2 },
      { id: "2", price: 100, stock: 10, quantity: 1 },
    ]);
    renderPage();

    expect(screen.getByText(/shopping cart/i)).toHaveTextContent("3 items");
    expect(screen.getByText("Product 1")).toBeInTheDocument();
    expect(screen.getByText("900 EGP")).toBeInTheDocument(); // line total
    expect(screen.getAllByText("1,000 EGP").length).toBe(2); // subtotal + total
    expect(screen.getByRole("button", { name: /proceed to checkout/i })).toBeInTheDocument();
  });

  it("adds one with the stepper, up to the stock snapshot", () => {
    seedCart([{ id: "1", price: 450, stock: 2, quantity: 1 }]);
    renderPage();

    const plus = screen.getByRole("button", { name: /increase quantity of product 1/i });
    fireEvent.click(plus);
    expect(screen.getByText(/shopping cart/i)).toHaveTextContent("2 items");
    expect(plus).toBeDisabled(); // capped at the stored stock snapshot
  });

  it("removes a line from the cart", () => {
    seedCart([{ id: "1", price: 450, stock: 10, quantity: 1 }]);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /remove product 1 from cart/i }));

    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });
});
