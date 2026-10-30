import { afterEach, describe, expect, it, vi } from "vitest";

/*
  Every mock-enabled API module must pick its implementation from the one
  `VITE_USE_MOCK` flag in lib/env. These tests re-evaluate the module graph
  with the flag on and off, then compare the selected export with the real
  and mock implementations.
*/

async function load(flag: string) {
  vi.stubEnv("VITE_USE_MOCK", flag);
  vi.resetModules();

  const [
    env,
    auth,
    authMock,
    catalog,
    catalogMock,
    legacyOrders,
    legacyOrdersMock,
    products,
    productsMock,
    dashboard,
    dashboardMock,
    reports,
    reportsMock,
    contact,
    contactMock,
    publicContact,
    publicContactMock,
    inventory,
    inventoryMock,
    notifications,
    notificationsMock,
    orders,
    ordersMock,
    orderBuilder,
    orderBuilderMock,
    categories,
    categoriesMock,
    suppliers,
    suppliersMock,
  ] = await Promise.all([
    import("../lib/env"),
    import("./authApi"),
    import("./mock/authMock"),
    import("./catalogApi"),
    import("./mock/catalogMock"),
    import("./ordersApi"),
    import("./mock/ordersMock"),
    import("./productsApi"),
    import("./mock/productsMock"),
    import("../features/dashboard/api"),
    import("../features/dashboard/mockApi"),
    import("../features/reports/api"),
    import("../features/reports/mockApi"),
    import("../features/contact/api"),
    import("../features/contact/mockApi"),
    import("../features/contact/publicApi"),
    import("../features/contact/publicMockApi"),
    import("../features/inventory/api"),
    import("../features/inventory/mockApi"),
    import("../features/notifications/api"),
    import("../features/notifications/mockApi"),
    import("../features/orders/api"),
    import("../features/orders/mockApi"),
    import("../features/orders/create/api"),
    import("../features/orders/create/mockApi"),
    import("../features/products/categories/api"),
    import("../features/products/categories/mockApi"),
    import("../features/products/suppliers/api"),
    import("../features/products/suppliers/mockApi"),
  ]);

  return {
    env,
    auth,
    authMock,
    catalog,
    catalogMock,
    legacyOrders,
    legacyOrdersMock,
    products,
    productsMock,
    dashboard,
    dashboardMock,
    reports,
    reportsMock,
    contact,
    contactMock,
    publicContact,
    publicContactMock,
    inventory,
    inventoryMock,
    notifications,
    notificationsMock,
    orders,
    ordersMock,
    orderBuilder,
    orderBuilderMock,
    categories,
    categoriesMock,
    suppliers,
    suppliersMock,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("VITE_USE_MOCK", () => {
  it("selects every mock module when the flag is exactly true", async () => {
    const m = await load("true");

    expect(m.env.USE_MOCK).toBe(true);
    expect(m.auth.authApi).toBe(m.authMock.mockAuthApi);
    expect(m.catalog.catalogApi).toBe(m.catalogMock.mockCatalogApi);
    expect(m.legacyOrders.ordersApi).toBe(m.legacyOrdersMock.default);
    expect(m.products.productsApi).toBe(m.productsMock.mockProductsApi);
    expect(m.dashboard.dashboardApi).toBe(m.dashboardMock.mockDashboardApi);
    expect(m.reports.reportsApi).toBe(m.reportsMock.mockReportsApi);
    expect(m.contact.contactMessagesApi).toBe(m.contactMock.mockContactMessagesApi);
    expect(m.publicContact.publicContactApi).toBe(m.publicContactMock.mockPublicContactApi);
    expect(m.inventory.inventoryApi).toBe(m.inventoryMock.mockInventoryApi);
    expect(m.notifications.notificationsApi).toBe(m.notificationsMock.mockNotificationsApi);
    expect(m.orders.customerOrdersApi).toBe(m.ordersMock.mockCustomerOrdersApi);
    expect(m.orders.staffOrdersApi).toBe(m.ordersMock.mockStaffOrdersApi);
    expect(m.orderBuilder.orderBuilderApi).toBe(m.orderBuilderMock.mockOrderBuilderApi);
    expect(m.categories.categoriesApi).toBe(m.categoriesMock.mockCategoriesApi);
    expect(m.suppliers.suppliersApi).toBe(m.suppliersMock.mockSuppliersApi);
  });

  it("selects the real modules when the flag is off", async () => {
    const m = await load("false");

    expect(m.env.USE_MOCK).toBe(false);
    expect(m.auth.authApi).not.toBe(m.authMock.mockAuthApi);
    expect(m.catalog.catalogApi).not.toBe(m.catalogMock.mockCatalogApi);
    expect(m.legacyOrders.ordersApi).not.toBe(m.legacyOrdersMock.default);
    expect(m.products.productsApi).not.toBe(m.productsMock.mockProductsApi);
    expect(m.dashboard.dashboardApi).not.toBe(m.dashboardMock.mockDashboardApi);
    expect(m.reports.reportsApi).not.toBe(m.reportsMock.mockReportsApi);
    expect(m.contact.contactMessagesApi).toBe(m.contact.realContactMessagesApi);
    expect(m.publicContact.publicContactApi).toBe(m.publicContact.realPublicContactApi);
    expect(m.inventory.inventoryApi).toBe(m.inventory.realInventoryApi);
    expect(m.notifications.notificationsApi).toBe(m.notifications.realNotificationsApi);
    expect(m.orders.customerOrdersApi).toBe(m.orders.realCustomerOrdersApi);
    expect(m.orders.staffOrdersApi).toBe(m.orders.realStaffOrdersApi);
    expect(m.orderBuilder.orderBuilderApi).toBe(m.orderBuilder.realOrderBuilderApi);
    expect(m.categories.categoriesApi).toBe(m.categories.realCategoriesApi);
    expect(m.suppliers.suppliersApi).toBe(m.suppliers.realSuppliersApi);
  });

  it.each(["TRUE", "1", "false", ""])("stays off for %j", async (flag) => {
    const m = await load(flag);
    expect(m.env.USE_MOCK).toBe(false);
    expect(m.auth.authApi).not.toBe(m.authMock.mockAuthApi);
  });
});
