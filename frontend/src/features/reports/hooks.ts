import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { reportsApi } from "./api";
import type { DateRange } from "./types";

export const TOP_LIMIT = 5;

/** Every query is keyed by the date range, so changing it refetches (and updates) all of them. */
export const reportKeys = {
  all: ["reports"] as const,
  summary: (r: DateRange) => ["reports", "summary", r.from, r.to] as const,
  overview: (r: DateRange) => ["reports", "overview", r.from, r.to] as const,
  categories: (r: DateRange) => ["reports", "categories", r.from, r.to] as const,
  top: (r: DateRange) => ["reports", "top", r.from, r.to, TOP_LIMIT] as const,
};

const keep = { placeholderData: keepPreviousData } as const; // no flicker while the new range loads

export const useSummary = (r: DateRange) => useQuery({ queryKey: reportKeys.summary(r), queryFn: () => reportsApi.summary(r), ...keep });
export const useOverview = (r: DateRange) => useQuery({ queryKey: reportKeys.overview(r), queryFn: () => reportsApi.overview(r), ...keep });
export const useCategories = (r: DateRange) => useQuery({ queryKey: reportKeys.categories(r), queryFn: () => reportsApi.categories(r), ...keep });
export const useTopProducts = (r: DateRange) => useQuery({ queryKey: reportKeys.top(r), queryFn: () => reportsApi.topProducts(r, TOP_LIMIT), ...keep });
