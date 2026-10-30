import type { PublicContactApi } from "./publicApi";

/*
  In-memory stand-in for the public `POST /contact` endpoint (VITE_USE_MOCK=true).
  Mirrors the backend acknowledgement: a submission always resolves with
  `{ received: true }`, including when the honeypot is filled (the fake backend
  has nothing to persist).
*/

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockPublicContactApi: PublicContactApi = {
  async submit() {
    await sleep(150);
    return { received: true };
  },
};
