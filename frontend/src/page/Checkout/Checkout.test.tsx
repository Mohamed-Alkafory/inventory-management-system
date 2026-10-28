import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "../../components/ui";
import CartProvider from "../../context/cart/CartProvider";
import type { InventoryProduct } from "../../types/inventory";
import type { CreatedOrder } from "../../types/orders";
import Checkout from "./Checkout";

const create = vi.hoisted(() => vi.fn());

vi.mock("../../api/ordersApi", () => ({
  ordersApi: { create, list: vi.fn(), get: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const product = (): InventoryProduct => ({
  id: "p-1",
  name: "Wireless Mouse",
  sku: "WM-204",
  categoryId: "c1",
  category: "Accessories",
  price: 450,
  stock: 142,
  reorderLevel: 40,
  status: "in_stock",
});

function seedCart() {
  localStorage.setItem("prodexa.cart.v1", JSON.stringify([{ product: product(), quantity: 2 }]));
}

/** Exposes the last navigation target so assertions can follow the redirect. */
let lastPath = "/";
function PathProbe() {
  const location = useLocation();
  useEffect(() => {
    lastPath = location.pathname;
  }, [location.pathname]);
  return null;
}

/** The toast text is asserted through the state hook that builds it. */
function ToastProbe() {
  const toast = useToast();
  // ToastProvider keeps messages internally; reading the live region is enough.
  void toast;
  return null;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/checkout"]}>
          <CartProvider>
            <PathProbe />
            <ToastProbe />
            <Checkout />
          </CartProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const placedOrder = (): CreatedOrder => ({ id: "o-1", orderNumber: "ORD-1042", totalAmount: 900, items: [] });

const fillForm = () => {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Ada Lovelace" } });
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0100000000" } });
  fireEvent.change(screen.getByLabelText(/country/i), { target: { value: "Egypt" } });
  fireEvent.change(screen.getByLabelText(/^city/i), { target: { value: "Cairo" } });
  fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: "1 Tahrir St" } });
};

beforeEach(() => {
  localStorage.clear();
  create.mockReset();
  create.mockResolvedValue(placedOrder());
  seedCart();
  lastPath = "/";
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Checkout page", () => {
  it("requires the mandatory fields before placing an order", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Checkout" });

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    expect(await screen.findByText("Full name is required.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("places one real order with the form details packed into notes", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Checkout" });
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith({
      items: [{ productId: "p-1", quantity: 2 }],
      customerName: "Ada Lovelace",
      customerPhone: "0100000000",
      notes: expect.stringContaining("Shipping: 1 Tahrir St"),
    });
  });

  it("returns to the cart when the cart is empty", async () => {
    localStorage.clear();
    renderPage();

    await waitFor(() => expect(lastPath).toBe("/cart"));
  });
});
