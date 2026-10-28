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

const optionalAmount = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), `${label} must be a number with up to 2 decimals`);

export const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(64, "SKU must be 64 characters or fewer")
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Use letters, numbers, dots, dashes or underscores"),
  name: z.string().trim().min(1, "Name is required").max(120, "Name must be 120 characters or fewer"),
  price: amount("Price"),
  costPrice: optionalAmount("Cost price"),
  categoryId: z.string().min(1, "Select a category"),
  // Optional on the backend: a product may have no supplier.
  supplierId: z.string(),
  minStock: z
    .string()
    .trim()
    .min(1, "Min stock is required")
    .refine((v) => v === "" || /^\d+$/.test(v), "Min stock must be a whole number (0 or more)"),
  // Display-only: the image itself is uploaded through POST /products/:id/image.
  // It stays in the form values so edit mode can show the current picture.
  imageUrl: z.string(),
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
    costPrice: p?.costPrice != null ? String(p.costPrice) : "",
    categoryId: p ? String(p.categoryId) : "",
    supplierId: p?.supplierId != null ? String(p.supplierId) : "",
    minStock: p ? String(p.minStock) : "0",
    imageUrl: p?.imageUrl ?? "",
    barcode: p?.barcode ?? "",
  };
}

// Select values are strings; send numeric ids back as numbers.
const asId = (v: string) => (/^\d+$/.test(v) ? Number(v) : v);

/**
 * Body for POST/PATCH /products. `imageUrl` is deliberately NOT sent: images
 * are managed through the dedicated upload/delete endpoints, so an edit never
 * clears an existing (local or external) image by accident.
 */
export function toPayload(v: ProductFormValues) {
  return {
    sku: v.sku,
    name: v.name,
    price: Number(v.price),
    costPrice: v.costPrice === "" ? null : Number(v.costPrice),
    categoryId: asId(v.categoryId),
    supplierId: v.supplierId === "" ? null : asId(v.supplierId),
    minStock: Number(v.minStock),
    barcode: v.barcode || null,
  };
}
