import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui";
import CartProvider from "../../context/cart/CartProvider";
import type { ShopProduct } from "../../types/shop";
import { ApiError } from "../../lib/http";
import Checkout from "./Checkout";

const createMyOrder = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({
  user: {
    id: "4",
    name: "Cara Customer",
    email: "customer@prodexa.com",
    role: "CUSTOMER",
  } as { id: string; name: string; email: string; role: string } | null,
}));

vi.mock("../../features/orders/hooks", () => ({
  useCreateMyOrder: () => ({
    mutateAsync: createMyOrder,
    isPending: false,
  }),
}));

vi.mock("../../context/auth/useAuth", () => ({
  useAuth: () => ({ user: auth.user }),
}));

const product = (): ShopProduct => ({
  id: "p-1",
  name: "Wireless Mouse",
  categoryId: "c1",
  category: "Accessories",
  price: 450,
  inStock: true,
  maxOrderable: 20,
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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/checkout"]}>
          <CartProvider>
            <PathProbe />
            <Checkout />
          </CartProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const placedOrder = () => ({
  id: "o-1",
  orderNumber: "ORD-1042",
  status: "PENDING" as const,
  totalAmount: 900,
  items: [],
  createdAt: "2026-01-01T00:00:00.000Z",
});

const fillForm = () => {
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0100000000" } });
  fireEvent.change(screen.getByLabelText(/^city/i), { target: { value: "Cairo" } });
  fireEvent.change(screen.getByLabelText(/^address/i), { target: { value: "1 Tahrir St" } });
};

beforeEach(() => {
  localStorage.clear();
  createMyOrder.mockReset();
  createMyOrder.mockResolvedValue(placedOrder());
  auth.user = {
    id: "4",
    name: "Cara Customer",
    email: "customer@prodexa.com",
    role: "CUSTOMER",
  };
  seedCart();
  lastPath = "/";
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Checkout page", () => {
  it("prefills the signed-in customer's name", async () => {
    renderPage();

    expect(await screen.findByLabelText(/full name/i)).toHaveValue("Cara Customer");
    expect(screen.getByText("Cash on delivery")).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.queryByLabelText(/country/i)).toBeNull();
    expect(screen.queryByLabelText(/postal code/i)).toBeNull();
  });

  it("requires the mandatory fields before placing an order", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Checkout" });

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    expect(await screen.findByText("Phone number is required.")).toBeInTheDocument();
    expect(screen.getByText("City is required.")).toBeInTheDocument();
    expect(screen.getByText("Address is required.")).toBeInTheDocument();
    expect(createMyOrder).not.toHaveBeenCalled();
  });

  it("places one /orders/mine order with the documented payload only", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Checkout" });
    fillForm();
    fireEvent.change(screen.getByLabelText(/order notes/i), { target: { value: "Call on arrival" } });

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => expect(createMyOrder).toHaveBeenCalled());
    expect(createMyOrder).toHaveBeenCalledWith({
      items: [{ productId: "p-1", quantity: 2 }],
      recipientName: "Cara Customer",
      recipientPhone: "0100000000",
      shippingAddress: "1 Tahrir St",
      shippingCity: "Cairo",
      notes: "Call on arrival",
    });
  });

  it("clears the cart and opens the new order after a successful placement", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Checkout" });
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => expect(lastPath).toBe("/orders/o-1"));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("prodexa.cart.v1") ?? "null")).toEqual([]));
  });

  it("names the failing product on 409 and keeps the cart intact", async () => {
    createMyOrder.mockRejectedValue(
      new ApiError(
        409,
        "Insufficient stock: product p-1 change -2 would push the quantity below zero",
        { serverMessage: "Insufficient stock: product p-1 change -2 would push the quantity below zero" },
      ),
    );
    renderPage();
    await screen.findByRole("heading", { name: "Checkout" });
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    expect(await screen.findByText(/wireless mouse.*no longer has enough stock/i)).toBeInTheDocument();
    expect(lastPath).toBe("/checkout");
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("prodexa.cart.v1") ?? "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0].product.id).toBe("p-1");
    });
  });

  it("puts 400 field errors under the matching input", async () => {
    createMyOrder.mockRejectedValue(
      new ApiError(400, "Validation failed", {
        serverMessage: "Validation failed",
        fieldErrors: { recipientPhone: "recipientPhone must be shorter than or equal to 20 characters" },
      }),
    );
    renderPage();
    await screen.findByRole("heading", { name: "Checkout" });
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    expect(
      await screen.findByText("recipientPhone must be shorter than or equal to 20 characters"),
    ).toBeInTheDocument();
    expect(screen.getByText("Please fix the highlighted fields and try again.")).toBeInTheDocument();
  });

  it("shows a friendly retry message on 429", async () => {
    createMyOrder.mockRejectedValue(new ApiError(429, "Too many requests"));
    renderPage();
    await screen.findByRole("heading", { name: "Checkout" });
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    expect(await screen.findByText(/wait a minute and try again/i)).toBeInTheDocument();
    expect(lastPath).toBe("/checkout");
  });

  it("sends anonymous visitors to login", async () => {
    auth.user = null;
    renderPage();

    await waitFor(() => expect(lastPath).toBe("/login"));
    expect(screen.queryByRole("heading", { name: "Checkout" })).toBeNull();
  });

  it("returns to the cart when the cart is empty", async () => {
    localStorage.clear();
    renderPage();

    await waitFor(() => expect(lastPath).toBe("/cart"));
  });
});
