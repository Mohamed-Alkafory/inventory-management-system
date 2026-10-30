import { withMock } from "../../api/mockSwitch";
import { toProductPage } from "../../api/productMappers";
import { rangeQueryString } from "../../lib/dateRange";
import { request } from "../../lib/http";
import { mockDashboardApi } from "./mockApi";
import type { DashboardApi, DashboardSummary, DateRange, SalesDay, StockMovementDay, TopProduct } from "./types";

export const DASHBOARD_ENDPOINTS = {
  summary: "/dashboard/summary",
  lowStock: "/dashboard/low-stock",
  sales: "/dashboard/sales",
  topProducts: "/dashboard/top-products",
  stockMovements: "/dashboard/stock-movements",
} as const;

const qs = (r: DateRange) => `?${rangeQueryString(r)}`;

const realDashboardApi: DashboardApi = {
  summary(r) {
    return request<DashboardSummary>(`${DASHBOARD_ENDPOINTS.summary}${qs(r)}`);
  },

  sales(r) {
    return request<SalesDay[]>(`${DASHBOARD_ENDPOINTS.sales}${qs(r)}`);
  },

  topProducts(r, limit) {
    return request<TopProduct[]>(`${DASHBOARD_ENDPOINTS.topProducts}${qs(r)}&limit=${limit}`);
  },

  stockMovements(r) {
    return request<StockMovementDay[]>(`${DASHBOARD_ENDPOINTS.stockMovements}${qs(r)}`);
  },

  async lowStock(page, limit) {
    return toProductPage(
      await request<unknown>(`${DASHBOARD_ENDPOINTS.lowStock}?page=${page}&limit=${limit}`),
    );
  },
};

export const dashboardApi: DashboardApi = withMock(realDashboardApi, mockDashboardApi);
