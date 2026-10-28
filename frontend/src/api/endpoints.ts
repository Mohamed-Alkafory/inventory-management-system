/*
  Auth endpoints — the only place that knows the backend paths.
  When the real auth API is merged, adjust these (and api/authMappers.ts) if they differ.
*/
export const AUTH_ENDPOINTS = {
  login: "/auth/login",
  register: "/auth/register",
  google: "/auth/google",
  refresh: "/auth/refresh",
  logout: "/auth/logout",
  me: "/auth/me",
  /** PATCH /auth/me — update own name and/or password. */
  updateMe: "/auth/me",
  /** POST /auth/change-password — change the own password (current + new). */
  changePassword: "/auth/change-password",
  /** DELETE /auth/me — deactivate the account (irreversible from the profile page). */
  deleteMe: "/auth/me",
} as const;

/*
  Product endpoints. The query-string names (page, limit, search, categoryId, stockStatus,
  sortBy, sortOrder) are built in api/productMappers.ts (toListParams).
*/
export const PRODUCT_ENDPOINTS = {
  list: "/products",
  categories: "/categories",
} as const;

/*
  Order endpoints. POST /orders takes { items: [{ productId, quantity }]
  plus optional customer info — prices and totals are computed server-side.
*/
export const ORDER_ENDPOINTS = {
  create: "/orders",
} as const;

/*
  Notification endpoints. The current user's unread list / read markers live
  under /notifications too — only the preferences are exposed here for now.
*/
export const NOTIFICATION_ENDPOINTS = {
  /** GET/PUT /notifications/preferences — own preference rows (defaults filled). */
  preferences: "/notifications/preferences",
} as const;
