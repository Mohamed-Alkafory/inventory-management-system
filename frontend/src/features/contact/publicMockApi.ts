import { ApiError } from "../../lib/http";
import type { PublicContactApi } from "./publicApi";

/*
  In-memory stand-in for the public `POST /contact` endpoint (VITE_USE_MOCK=true).
  Mirrors the backend acknowledgement: a submission always resolves with
  `{ received: true }`, including when the honeypot is filled (the fake backend
  has nothing to persist). Like the backend, it is throttled to 5 submissions
  per hour per browser tab.
*/

const HOUR = 3_600_000;
const RATE_LIMIT = 5;
const recent: number[] = [];

/** Test-only: forget submissions so each test starts with a fresh window. */
export function resetMockContactRateLimit(): void {
  recent.length = 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockPublicContactApi: PublicContactApi = {
  async submit() {
    await sleep(150);

    const now = Date.now();
    while (recent.length > 0 && now - recent[0] >= HOUR) recent.shift();
    if (recent.length >= RATE_LIMIT) {
      throw new ApiError(429, "Too many requests. Please slow down and try again.");
    }
    recent.push(now);

    return { received: true };
  },
};
