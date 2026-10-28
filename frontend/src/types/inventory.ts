import type { StockStatus } from "../components/ui/StatusBadge";

export type { StockStatus };

export const STOCK_STATUSES: StockStatus[] = ["in_stock", "low_stock", "out_of_stock"];

/** Columns the backend can sort by (`stock` is sent as `quantity`). */
export const PRODUCT_SORT_FIELDS = ["name", "sku", "price", "stock"] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

export type ProductCategory = {
  id: string;
  name: string;
};

/** A product row in the inventory list. */
export type InventoryProduct = {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  /** Optional: needed when opening the edit form. */
  supplierId?: string;
  barcode?: string;
  isActive?: boolean;
  /** Category name ("" when the API only sent the id; the hook fills it from the category list). */
  category: string;
  /** Optional marketing text shown on the product card. */
  description?: string;
  price: number;
  /** ADMIN only. The UI strips it for STAFF (and the backend never sends it to them). */
  costPrice?: number;
  /** Backend: `quantity`. */
  stock: number;
  /** Backend: `minStock`. */
  reorderLevel: number;
  status: StockStatus;
  imageUrl?: string;
};

/** Everything that decides which rows the list shows. Mirrored in the page URL. */
export type ProductQuery = {
  search: string;
  /** Category id, "" = all. */
  category: string;
  /** "" = all. */
  status: StockStatus | "";
  sortBy: ProductSortField | null;
  sortDir: SortDirection;
  /** 1-based. */
  page: number;
  pageSize: number;
};

export type ProductPage = {
  items: InventoryProduct[];
  /** Total rows matching the filters (all pages). */
  total: number;
};
