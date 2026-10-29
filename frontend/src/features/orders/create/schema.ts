import { z } from "zod";

const PHONE_CHARS = /^\+?[\d\s().-]+$/; // digits, spaces, dots, dashes, parentheses; "+" only at the start
const digitCount = (v: string) => v.replace(/\D/g, "").length;

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(120, "Name must be 120 characters or fewer"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .refine(
      (v) => v === "" || (PHONE_CHARS.test(v) && digitCount(v) >= 7 && digitCount(v) <= 15),
      "Enter a valid phone number, e.g. +20 100 123 4567",
    ),
  notes: z.string().trim().max(500, "Notes must be 500 characters or fewer"),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
