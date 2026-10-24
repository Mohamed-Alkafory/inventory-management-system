export type PageItem = number | "ellipsis-start" | "ellipsis-end";

/**
 * Page numbers to render (1-based). Always shows first and last page,
 * the current page and its neighbours, with ellipses in the gaps.
 */
export function getPageRange(current: number, count: number): PageItem[] {
  if (count <= 6) return Array.from({ length: count }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "ellipsis-end", count];
  if (current >= count - 2) return [1, "ellipsis-start", count - 3, count - 2, count - 1, count];
  return [1, "ellipsis-start", current - 1, current, current + 1, "ellipsis-end", count];
}
