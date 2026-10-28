import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ToastProvider from "../../components/ui/toast/ToastProvider";
import CartProvider from "../../context/cart/CartProvider";
import FavoritesProvider from "../../context/favorites/FavoritesProvider";
import type { InventoryProduct } from "../../types/inventory";
import Favorites from "./Favorites";

const product: InventoryProduct = {
  id: "1",
  name: "Wireless Mouse",
  sku: "WM-204",
  categoryId: "c1",
  category: "Accessories",
  price: 450,
  stock: 142,
  reorderLevel: 40,
  status: "in_stock",
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
  });

  it("un-hearts a product, which removes it from the page", () => {
    localStorage.setItem("prodexa.favorites.v1", JSON.stringify([product]));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /remove wireless mouse from favorites/i }));

    expect(screen.getByText(/no favorites yet/i)).toBeInTheDocument();
  });
});
