import { z } from "zod";

/** `change` is a string because it comes from a text input ("+10", "-3", "5"). */
export const adjustSchema = z.object({
  change: z
    .string()
    .trim()
    .min(1, "Enter a quantity")
    .refine((v) => v === "" || /^[+-]?\d+$/.test(v), "Enter a whole number, e.g. 10 or -3")
    .refine((v) => !/^[+-]?\d+$/.test(v) || Number(v) !== 0, "Change can’t be zero")
    .refine((v) => !/^[+-]?\d+$/.test(v) || Math.abs(Number(v)) <= 1_000_000, "That number is too large"),
  reason: z.string().trim().min(1, "Reason is required").max(255, "Reason must be 255 characters or fewer"),
});

export type AdjustFormValues = z.infer<typeof adjustSchema>;

/** "+10" / "-3" / "5" → number, or null when it isn't a whole number yet. */
export const parseChange = (v: string): number | null => (/^[+-]?\d+$/.test(v.trim()) ? Number(v.trim()) : null);
