import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { dashboardApi } from "./api";
import type { DateRange } from "./types";

export const TOP_PRODUCTS_LIMIT = 5;
export const LOW_STOCK_LIMIT = 8;

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: (r: DateRange) => [...dashboardKeys.all, "summary", r.from, r.to] as const,
  sales: (r: DateRange) => [...dashboardKeys.all, "sales", r.from, r.to] as const,
  topProducts: (r: DateRange) => [...dashboardKeys.all, "top-products", r.from, r.to, TOP_PRODUCTS_LIMIT] as const,
  stockMovements: (r: DateRange) => [...dashboardKeys.all, "stock-movements", r.from, r.to] as const,
  lowStock: (page: number, limit: number) => [...dashboardKeys.all, "low-stock", page, limit] as const,
};

const keep = { placeholderData: keepPreviousData } as const; // no flicker while a new range loads

export const useDashboardSummary = (range: DateRange) =>
  useQuery({ queryKey: dashboardKeys.summary(range), queryFn: () => dashboardApi.summary(range), ...keep });

export const useDashboardSales = (range: DateRange) =>
  useQuery({ queryKey: dashboardKeys.sales(range), queryFn: () => dashboardApi.sales(range), ...keep });

export const useDashboardTopProducts = (range: DateRange) =>
  useQuery({
    queryKey: dashboardKeys.topProducts(range),
    queryFn: () => dashboardApi.topProducts(range, TOP_PRODUCTS_LIMIT),
    ...keep,
  });

export const useDashboardStockMovements = (range: DateRange) =>
  useQuery({
    queryKey: dashboardKeys.stockMovements(range),
    queryFn: () => dashboardApi.stockMovements(range),
    ...keep,
  });

export const useDashboardLowStock = (page = 1, limit = LOW_STOCK_LIMIT) =>
  useQuery({
    queryKey: dashboardKeys.lowStock(page, limit),
    queryFn: () => dashboardApi.lowStock(page, limit),
    ...keep,
  });
