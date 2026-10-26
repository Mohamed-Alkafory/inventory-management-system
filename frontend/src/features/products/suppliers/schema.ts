import { z } from "zod";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS = /^\+?[\d\s().-]+$/; // digits, spaces, dots, dashes, parentheses; "+" only at the start
const digitCount = (v: string) => v.replace(/\D/g, "").length;

/*
  Every field is required. To make one optional, replace `.min(1, "...")` with `.optional()`
  logic (and relax its refine) — e.g. allow "" for contactPerson.
*/
export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name must be 120 characters or fewer"),
  contactPerson: z
    .string()
    .trim()
    .min(1, "Contact person is required")
    .max(120, "Contact person must be 120 characters or fewer"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .refine((v) => v === "" || EMAIL.test(v), "Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .refine(
      (v) => v === "" || (PHONE_CHARS.test(v) && digitCount(v) >= 7 && digitCount(v) <= 15),
      "Enter a valid phone number, e.g. +20 100 123 4567",
    ),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;
export type SupplierField = keyof SupplierFormValues;
export const SUPPLIER_FIELDS: SupplierField[] = ["name", "contactPerson", "email", "phone"];

export function toPayload(v: SupplierFormValues) {
  return { name: v.name, contactPerson: v.contactPerson, email: v.email.toLowerCase(), phone: v.phone };
}
