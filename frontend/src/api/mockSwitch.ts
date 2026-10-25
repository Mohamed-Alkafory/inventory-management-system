import { USE_MOCK } from "../lib/env";

/**
 * Picks the real or the mock implementation of an API module.
 * Use it for every resource while the backend is not ready:
 *
 *   export const productsApi = withMock(realProductsApi, mockProductsApi);
 */
export function withMock<T extends object>(real: T, mock: T): T {
  return USE_MOCK ? mock : real;
}

export const delay = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms));
