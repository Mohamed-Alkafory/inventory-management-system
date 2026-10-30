export const ORDERS_PATH = "/orders"; // customer "my orders"
export const STAFF_ORDERS_PATH = "/staff/orders";
export const ADMIN_ORDERS_PATH = "/admin/orders";
export const SUPPORT_ORDERS_PATH = "/support/orders";
export const orderPath = (id: string | number, basePath = ORDERS_PATH) => `${basePath}/${id}`;

const CURRENCY = "USD";
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY });
export const formatMoney = (n: number) => money.format(n);

const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
export const formatDate = (iso: string) => (iso ? dateOnly.format(new Date(iso)) : "—");
export const formatDateTime = (iso: string) => (iso ? dateTime.format(new Date(iso)) : "—");

export const formatNumber = (n: string) => (n.startsWith("#") ? n : `#${n}`);

/** Local calendar day "YYYY-MM-DD" of an ISO date-time (matches <input type="date">). */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
