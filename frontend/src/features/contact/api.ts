import { request } from "../../lib/http";
import { USE_MOCK } from "../../lib/env";
import { mockContactMessagesApi } from "./mockApi";
import { normalizeContactMessage, toContactPage } from "./normalize";
import type { ContactListParams, ContactMessagesApi, ContactUpdateInput, Id } from "./types";

export { USE_MOCK };

function listQuery(p: ContactListParams) {
  // The backend rejects unknown query params, so only the documented ones are sent.
  const q = new URLSearchParams({ page: String(p.page), limit: String(p.pageSize) });
  if (p.status) q.set("status", p.status);
  if (p.assignedToId) q.set("assignedToId", p.assignedToId);
  if (p.search.trim()) q.set("search", p.search.trim().slice(0, 100));
  return q.toString();
}

const encode = (id: Id) => encodeURIComponent(String(id));

export const realContactMessagesApi: ContactMessagesApi = {
  async list(p) {
    return toContactPage(await request<unknown>(`/contact-messages?${listQuery(p)}`));
  },
  async get(id) {
    return normalizeContactMessage(await request<unknown>(`/contact-messages/${encode(id)}`));
  },
  async update(id, patch: ContactUpdateInput) {
    return normalizeContactMessage(
      await request<unknown>(`/contact-messages/${encode(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    );
  },
};

export const contactMessagesApi: ContactMessagesApi = USE_MOCK ? mockContactMessagesApi : realContactMessagesApi;
