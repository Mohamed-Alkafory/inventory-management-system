import { tokenStorage } from "../../api/tokenStorage";
import { ApiError } from "../../lib/http";
import { can } from "../../lib/permissions";
import type { ContactAssignee, ContactMessage, ContactMessagesApi, ContactUpdateInput } from "./types";

/*
  In-memory stand-in for the private support inbox (VITE_USE_MOCK=true).
  Mirrors the backend rules: status filters, assignee filters, case-insensitive
  search over name/email/subject, newest first, and 404 for an unknown id.
*/

const SUPPORT_ID = "99999999-9999-4999-8999-999999999999";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

const DIRECTORY: Record<string, ContactAssignee> = {
  [SUPPORT_ID]: { id: SUPPORT_ID, name: "Sam Support", email: "support@prodexa.com", role: "SUPPORT" },
  [ADMIN_ID]: { id: ADMIN_ID, name: "Amira Admin", email: "admin@prodexa.com", role: "ADMIN" },
};

const HOUR = 3_600_000;
const now = Date.now();
const iso = (hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();

const SEED: ContactMessage[] = [
  {
    id: "88888888-8888-4888-8888-888888888801",
    name: "Jane Doe",
    email: "jane@example.com",
    subject: "Order arrived damaged",
    message: "The bottle in my order arrived with a cracked lid. Can you help me arrange a replacement?",
    status: "NEW",
    assignedToId: null,
    assignedTo: null,
    internalNote: null,
    createdAt: iso(2),
    updatedAt: iso(2),
  },
  {
    id: "88888888-8888-4888-8888-888888888802",
    name: "Omar Hassan",
    email: "omar@example.com",
    subject: "Question about delivery times",
    message: "How long does delivery usually take to Alexandria?",
    status: "IN_PROGRESS",
    assignedToId: SUPPORT_ID,
    assignedTo: DIRECTORY[SUPPORT_ID],
    internalNote: "Checking with the courier.",
    createdAt: iso(26),
    updatedAt: iso(20),
  },
  {
    id: "88888888-8888-4888-8888-888888888803",
    name: "Mona Fathy",
    email: "mona@example.com",
    subject: "Thanks!",
    message: "Just wanted to say the support team was very helpful. Thank you!",
    status: "RESOLVED",
    assignedToId: ADMIN_ID,
    assignedTo: DIRECTORY[ADMIN_ID],
    internalNote: "Resolved and closed.",
    createdAt: iso(50),
    updatedAt: iso(48),
  },
];

let db: ContactMessage[] = SEED.map((m) => ({ ...m }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LATENCY = 120;
const notFound = () => new ApiError(404, "Contact message not found", { serverMessage: "Contact message not found" });
const forbidden = () =>
  new ApiError(403, "You don't have permission to do that.", { serverMessage: "Forbidden resource" });
const find = (id: string | number) => db.find((m) => m.id === String(id));

/** The real inbox is limited to `contact.read` (list/detail) and `contact.manage` (triage). */
function requireRead() {
  if (!can(tokenStorage.getSession()?.user.role, "contact.read")) throw forbidden();
}

function requireManage() {
  if (!can(tokenStorage.getSession()?.user.role, "contact.manage")) throw forbidden();
}

function assigneeFor(id: string): ContactAssignee {
  const known = DIRECTORY[id];
  if (known) return known;
  const user = tokenStorage.getSession()?.user;
  if (user && user.id === id) {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
  return { id, name: "Support user", email: "", role: "SUPPORT" };
}

function matches(m: ContactMessage, search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [m.name, m.email, m.subject].some((value) => value.toLowerCase().includes(q));
}

export const mockContactMessagesApi: ContactMessagesApi = {
  async list(params) {
    await sleep(LATENCY);
    requireRead();
    const rows = db
      .filter(
        (m) =>
          (!params.status || m.status === params.status) &&
          (!params.assignedToId || m.assignedToId === params.assignedToId) &&
          matches(m, params.search),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    const start = (params.page - 1) * params.pageSize;
    return { items: rows.slice(start, start + params.pageSize), total: rows.length };
  },

  async get(id) {
    await sleep(LATENCY);
    requireRead();
    const message = find(id);
    if (!message) throw notFound();
    return { ...message };
  },

  async update(id, patch: ContactUpdateInput) {
    await sleep(LATENCY);
    requireManage();
    const current = find(id);
    if (!current) throw notFound();

    const next: ContactMessage = { ...current, updatedAt: new Date().toISOString() };
    if (patch.status !== undefined) next.status = patch.status;
    if (patch.assignedToId !== undefined) {
      next.assignedToId = patch.assignedToId;
      next.assignedTo = patch.assignedToId ? assigneeFor(patch.assignedToId) : null;
    }
    if (patch.internalNote !== undefined) next.internalNote = patch.internalNote;

    db = db.map((m) => (m.id === next.id ? next : m));
    return { ...next };
  },
};
