import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./errors";

/** Shared instance so non-React code (e.g. logout) can clear the cache too. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = error instanceof ApiError ? error.status : null;
        if (status !== null && status >= 400 && status < 500) return false; // client errors won't fix themselves
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});
