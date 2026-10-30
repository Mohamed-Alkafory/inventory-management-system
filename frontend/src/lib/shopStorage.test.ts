import { beforeEach, describe, expect, it } from "vitest";
import type { CartItem, ShopProduct } from "../types/shop";
import { shopStorage } from "./shopStorage";

const product: ShopProduct = {
  id: "p-1",
  name: "Wireless Mouse",
  price: 450,
  imageUrl: "/uploads/mouse.png",
  category: "Accessories",
  inStock: true,
  maxOrderable: 5,
};

beforeEach(() => {
  shopStorage.clearAll();
});

describe("shopStorage cart", () => {
  it("persists only the customer-safe catalog fields", () => {
    const line: CartItem = { product, quantity: 2 };
    shopStorage.saveCart([line]);

    const raw = JSON.parse(localStorage.getItem("prodexa.cart.v1") ?? "[]");
    expect(raw).toEqual([
      {
        product: {
          id: "p-1",
          name: "Wireless Mouse",
          price: 450,
          imageUrl: "/uploads/mouse.png",
          maxOrderable: 5,
          category: "Accessories",
        },
        quantity: 2,
      },
    ]);
  });

  it("clamps quantities to maxOrderable on read", () => {
    localStorage.setItem(
      "prodexa.cart.v1",
      JSON.stringify([{ product: { ...product, maxOrderable: 3 }, quantity: 99 }]),
    );

    const [line] = shopStorage.readCart();
    expect(line.quantity).toBe(3);
  });

  it("migrates a legacy snapshot that stored `stock`", () => {
    localStorage.setItem(
      "prodexa.cart.v1",
      JSON.stringify([
        {
          product: {
            id: "p-9",
            name: "Legacy Keyboard",
            sku: "KB-310",
            categoryId: "c2",
            category: "Accessories",
            price: 1850,
            stock: 12,
            reorderLevel: 3,
            status: "in_stock",
          },
          quantity: 7,
        },
      ]),
    );

    expect(shopStorage.readCart()).toEqual([
      {
        product: {
          id: "p-9",
          name: "Legacy Keyboard",
          price: 1850,
          imageUrl: undefined,
          category: "Accessories",
          categoryId: "c2",
          inStock: true,
          maxOrderable: 12,
        },
        quantity: 7,
      },
    ]);
  });

  it("drops invalid rows and out-of-stock lines", () => {
    localStorage.setItem(
      "prodexa.cart.v1",
      JSON.stringify([
        { product: { id: "missing-name", price: 1 }, quantity: 1 },
        { product: { ...product, maxOrderable: 0, inStock: false }, quantity: 1 },
        null,
        "nope",
      ]),
    );

    expect(shopStorage.readCart()).toEqual([]);
  });

  it("returns an empty cart for corrupt JSON", () => {
    localStorage.setItem("prodexa.cart.v1", "{not json");
    expect(shopStorage.readCart()).toEqual([]);
  });

  it("returns an empty cart when the payload is not an array", () => {
    localStorage.setItem("prodexa.cart.v1", JSON.stringify({ product, quantity: 1 }));
    expect(shopStorage.readCart()).toEqual([]);
  });
});

describe("shopStorage favorites", () => {
  it("persists only the customer-safe catalog fields", () => {
    shopStorage.saveFavorites([product]);

    const raw = JSON.parse(localStorage.getItem("prodexa.favorites.v1") ?? "[]");
    expect(raw).toEqual([
      {
        id: "p-1",
        name: "Wireless Mouse",
        price: 450,
        imageUrl: "/uploads/mouse.png",
        maxOrderable: 5,
        category: "Accessories",
      },
    ]);
  });

  it("sanitizes legacy rows, migrates stock and de-duplicates by id", () => {
    const legacy = {
      id: "p-4",
      name: "Studio Microphone",
      sku: "SM-100",
      category: "Audio",
      price: 2600,
      stock: 14,
      status: "in_stock",
    };
    localStorage.setItem(
      "prodexa.favorites.v1",
      JSON.stringify([legacy, legacy, { id: "broken" }, "garbage"]),
    );

    expect(shopStorage.readFavorites()).toEqual([
      {
        id: "p-4",
        name: "Studio Microphone",
        price: 2600,
        imageUrl: undefined,
        category: "Audio",
        categoryId: undefined,
        inStock: true,
        maxOrderable: 14,
      },
    ]);
  });
});
