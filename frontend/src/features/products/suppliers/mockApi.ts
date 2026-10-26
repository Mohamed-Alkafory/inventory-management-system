import { ApiError } from "../../../lib/http";
import { matchesSearch } from "./normalize";
import type { Supplier, SuppliersApi } from "./types";

/*
  In-memory stand-in for the backend, used until the real API is merged.
  Search, pagination, duplicate emails (409) and deactivation behave like the real one should.
  Data resets on page reload.
*/

let nextId = 13;
let db: Supplier[] = [
  { id: 1, name: "Tech Global", contactPerson: "Ahmed Rami", email: "tech@global.com", phone: "+20 100 123 4567", isActive: true },
  { id: 2, name: "Fresh Foods Co.", contactPerson: "Sara Ali", email: "sales@freshfoods.com", phone: "+20 109 876 5432", isActive: true },
  { id: 3, name: "BuildMart", contactPerson: "Mohamed Ali", email: "info@buildmart.com", phone: "+20 111 203 3333", isActive: true },
  { id: 4, name: "Fashion Hub", contactPerson: "Nada Hassan", email: "contact@fashionhub.com", phone: "+20 112 334 4556", isActive: true },
  { id: 5, name: "Home Essentials", contactPerson: "Youssef Khaled", email: "support@homeessentials.com", phone: "+20 115 667 8899", isActive: true },
  { id: 6, name: "Nile Electronics", contactPerson: "Omar Hassan", email: "orders@nileelectronics.com", phone: "+20 102 555 0141", isActive: true },
  { id: 7, name: "Delta Packaging", contactPerson: "Laila Mostafa", email: "hello@deltapack.com", phone: "+20 106 222 7788", isActive: true },
  { id: 8, name: "Cairo Office Supplies", contactPerson: "Karim Nabil", email: "karim@cairooffice.com", phone: "+20 100 909 1212", isActive: false },
  { id: 9, name: "Alex Textiles", contactPerson: "Mona Fathy", email: "sales@alextextiles.com", phone: "+20 103 444 6677", isActive: true },
  { id: 10, name: "Giza Toys", contactPerson: "Hany Samir", email: "info@gizatoys.com", phone: "+20 120 333 1010", isActive: true },
  { id: 11, name: "Sinai Sports", contactPerson: "Dina Adel", email: "team@sinaisports.com", phone: "+20 127 818 2020", isActive: true },
  { id: 12, name: "Luxor Home Goods", contactPerson: "Tarek Wahba", email: "tarek@luxorhome.com", phone: "+20 114 700 3030", isActive: true },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LATENCY = 350;

const emailTaken = (email: string, exceptId?: Supplier["id"]) =>
  db.some((s) => s.id !== exceptId && s.email.toLowerCase() === email.trim().toLowerCase());

const dupEmail = () => {
  const msg = "A supplier with this email already exists";
  return new ApiError(409, msg, { fieldErrors: { email: msg }, serverMessage: msg });
};
const notFound = () => new ApiError(404, "Supplier not found", { serverMessage: "Supplier not found" });

export const mockSuppliersApi: SuppliersApi = {
  async list({ search, page, pageSize }) {
    await sleep(LATENCY);
    const all = db.filter((s) => matchesSearch(s, search));
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize).map((s) => ({ ...s })), total: all.length };
  },

  async create(v) {
    await sleep(LATENCY);
    if (emailTaken(v.email)) throw dupEmail();
    db = [...db, { id: nextId++, ...v, isActive: true }];
  },

  async update(id, v) {
    await sleep(LATENCY);
    if (!db.some((s) => s.id === id)) throw notFound();
    if (emailTaken(v.email, id)) throw dupEmail();
    db = db.map((s) => (s.id === id ? { ...s, ...v } : s));
  },

  async deactivate(id) {
    await sleep(LATENCY);
    if (!db.some((s) => s.id === id)) throw notFound();
    db = db.map((s) => (s.id === id ? { ...s, isActive: false } : s));
  },
};
