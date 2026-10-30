/** A public category from GET /catalog/categories. */
export type CatalogCategory = {
  id: string;
  name: string;
};

/**
 * The customer-safe product shape returned by the public catalog.
 * It intentionally never carries sku, cost, exact stock, supplier or barcode.
 */
export type ShopProduct = {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  /** Category name (the catalog sends `{ id, name }`). */
  category: string;
  categoryId?: string;
  inStock: boolean;
  /** Maximum quantity a customer may order (already capped by the backend). */
  maxOrderable: number;
};

/** Public catalog query. Mirrors GET /catalog/products. */
export type CatalogQuery = {
  search: string;
  /** Category id, "" = all. */
  category: string;
  sort: "newest" | "name" | "price";
  order: "asc" | "desc";
  /** 1-based. */
  page: number;
  pageSize: number;
};

export type CatalogPage = {
  items: ShopProduct[];
  total: number;
  totalPages: number;
  page: number;
};

/**
 * Client-side shopping state. Products are stored as small catalog snapshots
 * (localStorage) — never internal inventory fields. The authoritative price and
 * availability come from the server again at checkout.
 */
export type CartItem = {
  product: ShopProduct;
  quantity: number;
};
