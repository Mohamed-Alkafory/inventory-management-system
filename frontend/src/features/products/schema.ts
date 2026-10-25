import { z } from "zod";
import type { Product } from "./types";

/*
  Every field is a string on purpose: that is what HTML inputs give us, so the form
  type and the validated type are the same. Numbers are converted in `toPayload`.
*/

const amount = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), `${label} must be a number with up to 2 decimals`);

const isHttpUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(64, "SKU must be 64 characters or fewer")
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Use letters, numbers, dots, dashes or underscores"),
  name: z.string().trim().min(1, "Name is required").max(120, "Name must be 120 characters or fewer"),
  price: amount("Price"),
  costPrice: amount("Cost price"),
  categoryId: z.string().min(1, "Select a category"),
  supplierId: z.string().min(1, "Select a supplier"),
  minStock: z
    .string()
    .trim()
    .min(1, "Min stock is required")
    .refine((v) => v === "" || /^\d+$/.test(v), "Min stock must be a whole number (0 or more)"),
  imageUrl: z.string().trim().refine((v) => v === "" || isHttpUrl(v), "Enter a valid image URL (https://…)"),
  barcode: z.string().trim().max(64, "Barcode must be 64 characters or fewer"),
});

export type ProductFormValues = z.infer<typeof productSchema>;
export type ProductField = keyof ProductFormValues;

export const PRODUCT_FIELDS: ProductField[] = [
  "sku",
  "name",
  "price",
  "costPrice",
  "categoryId",
  "supplierId",
  "minStock",
  "imageUrl",
  "barcode",
];

export function toDefaults(p?: Product): ProductFormValues {
  return {
    sku: p?.sku ?? "",
    name: p?.name ?? "",
    price: p ? String(p.price) : "",
    costPrice: p ? String(p.costPrice) : "",
    categoryId: p ? String(p.categoryId) : "",
    supplierId: p ? String(p.supplierId) : "",
    minStock: p ? String(p.minStock) : "0",
    imageUrl: p?.imageUrl ?? "",
    barcode: p?.barcode ?? "",
  };
}

// Select values are strings; send numeric ids back as numbers.
const asId = (v: string) => (/^\d+$/.test(v) ? Number(v) : v);

export function toPayload(v: ProductFormValues) {
  return {
    sku: v.sku,
    name: v.name,
    price: Number(v.price),
    costPrice: Number(v.costPrice),
    categoryId: asId(v.categoryId),
    supplierId: asId(v.supplierId),
    minStock: Number(v.minStock),
    imageUrl: v.imageUrl || null,
    barcode: v.barcode || null,
  };
}
