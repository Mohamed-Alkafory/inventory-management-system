import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ToastProvider from "../../components/ui/toast/ToastProvider";
import CartProvider from "../../context/cart/CartProvider";
import { useCart } from "../../context/cart/useCart";
import type { ShopProduct } from "../../types/shop";
import Cart from "./Cart";

const product = (over: Partial<ShopProduct> & { id: string }): ShopProduct => ({
  name: `Product ${over.id}`,
  categoryId: "c1",
  category: "Accessories",
  price: 450,
  inStock: true,
  maxOrderable: 10,
  ...over,
});

type SeedLine = { id: string; price: number; maxOrderable?: number; quantity: number };

const seedCart = (items: SeedLine[]) => {
  localStorage.setItem(
    "prodexa.cart.v1",
    JSON.stringify(
      items.map(({ id, price, maxOrderable = 10, quantity }) => ({
        product: product({ id, price, maxOrderable, inStock: maxOrderable > 0 }),
        quantity,
      })),
    ),
  );
};

function renderPage(extra?: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/cart"]}>
          <CartProvider>
            {extra}
            <Cart />
          </CartProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** Attempts to add one more distinct product, exposing the provider's answer. */
function ExtraProductProbe() {
  const { addToCart, items } = useCart();
  const [result, setResult] = useState("");
  return (
    <>
      <button type="button" onClick={() => setResult(String(addToCart(product({ id: "p-extra" }))))}>
        Add extra product
      </button>
      <span data-testid="add-result">{result}</span>
      <span data-testid="distinct-count">{items.length}</span>
    </>
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
      { id: "1", price: 450, maxOrderable: 10, quantity: 2 },
      { id: "2", price: 100, maxOrderable: 10, quantity: 1 },
    ]);
    renderPage();

    expect(screen.getByText(/shopping cart/i)).toHaveTextContent("3 items");
    expect(screen.getByText("Product 1")).toBeInTheDocument();
    expect(screen.getByText("900 EGP")).toBeInTheDocument(); // line total
    expect(screen.getAllByText("1,000 EGP").length).toBe(2); // subtotal + total
    expect(screen.getByRole("button", { name: /proceed to checkout/i })).toBeInTheDocument();
    // Never exposes an SKU or exact stock.
    expect(screen.queryByText(/sku/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/in stock/i)).not.toBeInTheDocument();
  });

  it("adds one with the stepper, up to maxOrderable", () => {
    seedCart([{ id: "1", price: 450, maxOrderable: 2, quantity: 1 }]);
    renderPage();

    const plus = screen.getByRole("button", { name: /increase quantity of product 1/i });
    fireEvent.click(plus);
    expect(screen.getByText(/shopping cart/i)).toHaveTextContent("2 items");
    expect(plus).toBeDisabled(); // capped at the catalog's maxOrderable
  });

  it("caps each line at 50 even when the catalogue allows more", () => {
    seedCart([{ id: "1", price: 10, maxOrderable: 100, quantity: 60 }]);
    renderPage();

    expect(screen.getByText(/shopping cart/i)).toHaveTextContent("50 items");
    expect(screen.getByText("Product 1")).toBeInTheDocument();
  });

  it("explains a cart with more than 30 distinct products and blocks checkout", () => {
    seedCart(
      Array.from({ length: 31 }, (_, i) => ({
        id: `p-${i + 1}`,
        price: 10,
        maxOrderable: 10,
        quantity: 1,
      })),
    );
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/31 different products.*at most 30/i);
    expect(screen.getByRole("button", { name: /proceed to checkout/i })).toBeDisabled();
  });

  it("refuses to add a 31st distinct product", () => {
    seedCart(
      Array.from({ length: 30 }, (_, i) => ({
        id: `p-${i + 1}`,
        price: 10,
        maxOrderable: 10,
        quantity: 1,
      })),
    );
    renderPage(<ExtraProductProbe />);

    fireEvent.click(screen.getByRole("button", { name: /add extra product/i }));

    expect(screen.getByTestId("add-result")).toHaveTextContent("false");
    expect(screen.getByTestId("distinct-count")).toHaveTextContent("30");
    expect(screen.queryByText("Product p-extra")).toBeNull();
  });

  it("clamps a legacy over-quantity line to maxOrderable on load", () => {
    seedCart([{ id: "1", price: 450, maxOrderable: 2, quantity: 9 }]);
    renderPage();

    expect(screen.getByText(/shopping cart/i)).toHaveTextContent("2 items");
    expect(screen.queryByText(/only 2 available/i)).not.toBeInTheDocument();
  });

  it("migrates legacy inventory snapshots that stored `stock`", () => {
    localStorage.setItem(
      "prodexa.cart.v1",
      JSON.stringify([
        {
          // Old shape: full inventory product with sku/stock/reorderLevel/status.
          product: {
            id: "7",
            name: "Legacy Mouse",
            sku: "WM-204",
            categoryId: "c1",
            category: "Accessories",
            price: 450,
            stock: 4,
            reorderLevel: 1,
            status: "in_stock",
          },
          quantity: 2,
        },
      ]),
    );
    renderPage();

    expect(screen.getByText("Legacy Mouse")).toBeInTheDocument();
    expect(screen.getByText(/shopping cart/i)).toHaveTextContent("2 items");
    // Re-persisted in the customer-safe shape.
    const stored = JSON.parse(localStorage.getItem("prodexa.cart.v1") ?? "[]");
    expect(stored[0].product).toMatchObject({ id: "7", maxOrderable: 4 });
    expect(stored[0].product).not.toHaveProperty("sku");
    expect(stored[0].product).not.toHaveProperty("stock");
  });

  it("drops invalid rows instead of crashing", () => {
    localStorage.setItem(
      "prodexa.cart.v1",
      JSON.stringify([{ product: { id: "1" }, quantity: 1 }, { nope: true }, "garbage"]),
    );
    renderPage();

    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it("removes a line from the cart", () => {
    seedCart([{ id: "1", price: 450, maxOrderable: 10, quantity: 1 }]);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /remove product 1 from cart/i }));

    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });
});
