export const PO_PATH = "/admin/purchase-orders";
export const STAFF_PO_PATH = "/staff/purchase-orders";
export const poPath = (id: string | number, basePath = PO_PATH) => `${basePath}/${id}`;

const CURRENCY = "USD";
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY });
export const formatMoney = (n: number) => money.format(n);

const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
export const formatDate = (iso: string | null) => (iso ? dateOnly.format(new Date(iso)) : "—");
export const formatDateTime = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : "—");
