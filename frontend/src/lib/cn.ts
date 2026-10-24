type ClassValue = string | false | null | undefined;

/** Joins class names, skipping falsy values. */
export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}
