import { describe, expect, it } from "vitest";
import { deriveStockStatus, toCategories, toListParams, toProduct, toProductPage } from "./productMappers";
import { DEFAULT_QUERY } from "../page/Products/productQuery";

describe("product mappers", () => {
  it("derives the stock status from the numbers", () => {
    expect(deriveStockStatus(0, 10)).toBe("out_of_stock");
    expect(deriveStockStatus(10, 10)).toBe("low_stock");
    expect(deriveStockStatus(11, 10)).toBe("in_stock");
  });

  it("maps a product exactly as the backend sends it", () => {
    const p = toProduct({
      id: "0b6f1c0e-0000-4000-8000-000000000001",
      sku: "OFF-PEN-002",
      name: "Ballpoint Pen",
      description: null,
      imageUrl: null,
      barcode: null,
      price: 19.99,
      costPrice: null,
      quantity: 3,
      minStock: 5,
      isActive: true,
      categoryId: "c1",
      supplierId: null,
    });
    expect(p).toMatchObject({ categoryId: "c1", category: "", price: 19.99, stock: 3, reorderLevel: 5, status: "low_stock" });
    expect(p.costPrice).toBeUndefined();
    expect(p.imageUrl).toBeUndefined();
  });

  it("maps snake_case products and normalises the status", () => {
    const p = toProduct({
      _id: 7,
      title: "Cable",
      sku: "C-1",
      category: { name: "Accessories" },
      price: "120",
      cost_price: 55,
      quantity: 3,
      reorder_level: 5,
      status: "LOW-STOCK",
      image_url: "https://img/x.png",
    });
    expect(p).toMatchObject({
      id: "7",
      name: "Cable",
      category: "Accessories",
      price: 120,
      costPrice: 55,
      stock: 3,
      status: "low_stock",
      imageUrl: "https://img/x.png",
    });
  });

  it("leaves costPrice undefined when the API doesn't send it", () => {
    expect(toProduct({ id: "1", name: "A", price: 1, stock: 1 }).costPrice).toBeUndefined();
  });

  it("reads wrapped lists and totals", () => {
    const page = toProductPage({ data: [{ id: 1, name: "A" }], meta: { total: 42 } });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(42);
  });

  it("rejects responses that are not product lists", () => {
    expect(() => toProductPage({ nope: true })).toThrow();
  });

  it("reads the category list", () => {
    expect(toCategories({ data: [{ id: "2", name: "B" }, { id: "1", name: "A" }], meta: { total: 2 } })).toEqual([
      { id: "1", name: "A" },
      { id: "2", name: "B" },
    ]);
  });

  it("builds list params without empty filters", () => {
    expect(toListParams(DEFAULT_QUERY)).toEqual({ page: 1, limit: 10 });
    expect(
      toListParams({ ...DEFAULT_QUERY, search: "x", category: "c1", status: "low_stock", sortBy: "stock", sortDir: "desc" }),
    ).toEqual({
      page: 1,
      limit: 10,
      search: "x",
      categoryId: "c1",
      stockStatus: "low_stock",
      sortBy: "quantity",
      sortOrder: "desc",
    });
  });
});
