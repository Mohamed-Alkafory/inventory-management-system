import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ToastProvider from "../../components/ui/toast/ToastProvider";
import CartProvider from "../../context/cart/CartProvider";
import FavoritesProvider from "../../context/favorites/FavoritesProvider";
import type { ShopProduct } from "../../types/shop";
import Favorites from "./Favorites";

const product: ShopProduct = {
  id: "1",
  name: "Wireless Mouse",
  categoryId: "c1",
  category: "Accessories",
  price: 450,
  inStock: true,
  maxOrderable: 20,
};

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/favorites"]}>
        <CartProvider>
          <FavoritesProvider>
            <Favorites />
          </FavoritesProvider>
        </CartProvider>
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Favorites page", () => {
  it("shows the empty state with a way back to the products", () => {
    renderPage();

    expect(screen.getByText(/no favorites yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse products/i })).toBeInTheDocument();
  });

  it("renders stored favorites as cards with the heart pressed", () => {
    localStorage.setItem("prodexa.favorites.v1", JSON.stringify([product]));
    renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("1 item");
    expect(screen.getByText("Wireless Mouse")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove wireless mouse from favorites/i })).toHaveAttribute("aria-pressed", "true");
    // Customer-safe card only.
    expect(screen.queryByText(/sku/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/20 in stock/i)).not.toBeInTheDocument();
  });

  it("orders a favorite through the catalog snapshot", () => {
    localStorage.setItem("prodexa.favorites.v1", JSON.stringify([product]));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^order$/i }));

    const stored = JSON.parse(localStorage.getItem("prodexa.cart.v1") ?? "[]");
    expect(stored[0].product).toMatchObject({ id: "1", name: "Wireless Mouse", maxOrderable: 20 });
    expect(stored[0].product).not.toHaveProperty("sku");
    expect(stored[0].product).not.toHaveProperty("stock");
  });

  it("disables ordering for an out-of-stock favorite", () => {
    localStorage.setItem(
      "prodexa.favorites.v1",
      JSON.stringify([{ ...product, inStock: false, maxOrderable: 0 }]),
    );
    renderPage();

    expect(screen.getAllByText("Out of stock").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /out of stock/i })).toBeDisabled();
  });

  it("un-hearts a product, which removes it from the page", () => {
    localStorage.setItem("prodexa.favorites.v1", JSON.stringify([product]));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /remove wireless mouse from favorites/i }));

    expect(screen.getByText(/no favorites yet/i)).toBeInTheDocument();
  });

  it("sanitizes legacy favorites and drops invalid rows", () => {
    localStorage.setItem(
      "prodexa.favorites.v1",
      JSON.stringify([
        {
          id: "9",
          name: "Legacy Keyboard",
          sku: "KB-310",
          categoryId: "c2",
          category: "Accessories",
          price: 1850,
          stock: 36,
          reorderLevel: 15,
          status: "in_stock",
        },
        { id: "broken" },
        "garbage",
      ]),
    );
    renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("1 item");
    expect(screen.getByText("Legacy Keyboard")).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem("prodexa.favorites.v1") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: "9", name: "Legacy Keyboard", maxOrderable: 36 });
    expect(stored[0]).not.toHaveProperty("sku");
    expect(stored[0]).not.toHaveProperty("stock");
  });
});
