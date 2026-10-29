import type { StockStatus } from "./types";

export const statusFor = (stock: number, reorderPoint: number): StockStatus =>
  stock <= 0 ? "out_of_stock" : stock <= reorderPoint ? "low_stock" : "in_stock";

export const STATUS_LABEL: Record<StockStatus, string> = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
};

export const STATUSES: StockStatus[] = ["in_stock", "low_stock", "out_of_stock"];
