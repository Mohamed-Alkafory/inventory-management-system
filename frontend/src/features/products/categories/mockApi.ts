import { ApiError } from "../../../lib/http";
import type { CategoriesApi, Category } from "./types";

/*
  In-memory stand-in for the backend, used until the real API is merged.
  It behaves like the real one should: search, pagination, product counts,
  duplicate names, and a 409 when deleting a category that still has products.
  Data resets on page reload.
*/

let nextId = 14;
let db: Category[] = [
  { id: 1, name: "Electronics", productCount: 24 },
  { id: 2, name: "Apparel", productCount: 18 },
  { id: 3, name: "Accessories", productCount: 9 },
  { id: 4, name: "Bags", productCount: 6 },
  { id: 5, name: "Footwear", productCount: 12 },
  { id: 6, name: "Home & Kitchen", productCount: 15 },
  { id: 7, name: "Home & Office", productCount: 7 },
  { id: 8, name: "Sports", productCount: 0 },
  { id: 9, name: "Toys", productCount: 0 },
  { id: 10, name: "Stationery", productCount: 3 },
  { id: 11, name: "Beauty", productCount: 5 },
  { id: 12, name: "Garden", productCount: 0 },
  { id: 13, name: "Pet Supplies", productCount: 1 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LATENCY = 350;

const duplicate = (name: string, exceptId?: Category["id"]) =>
  db.some((c) => c.id !== exceptId && c.name.toLowerCase() === name.trim().toLowerCase());

const dupError = () => {
  const msg = "A category with this name already exists";
  return new ApiError(409, msg, { fieldErrors: { name: msg }, serverMessage: msg });
};

export const mockCategoriesApi: CategoriesApi = {
  async list({ search, page, pageSize }) {
    await sleep(LATENCY);
    const q = search.trim().toLowerCase();
    const all = db.filter((c) => !q || c.name.toLowerCase().includes(q));
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize).map((c) => ({ ...c })), total: all.length };
  },

  async create({ name }) {
    await sleep(LATENCY);
    if (duplicate(name)) throw dupError();
    db = [...db, { id: nextId++, name: name.trim(), productCount: 0 }];
  },

  async update(id, { name }) {
    await sleep(LATENCY);
    if (!db.some((c) => c.id === id)) throw new ApiError(404, "Category not found", { serverMessage: "Category not found" });
    if (duplicate(name, id)) throw dupError();
    db = db.map((c) => (c.id === id ? { ...c, name: name.trim() } : c));
  },

  async remove(id) {
    await sleep(LATENCY);
    const cat = db.find((c) => c.id === id);
    if (!cat) throw new ApiError(404, "Category not found", { serverMessage: "Category not found" });
    if (cat.productCount > 0) {
      const n = cat.productCount;
      const msg = `This category still has ${n} product${n === 1 ? "" : "s"}. Reassign or deactivate them before deleting it.`;
      throw new ApiError(409, msg, { serverMessage: msg });
    }
    db = db.filter((c) => c.id !== id);
  },
};
