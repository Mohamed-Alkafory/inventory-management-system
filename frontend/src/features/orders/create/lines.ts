import type { DraftLine, StockFailure } from "./types";

/** Money is summed in cents so 0.1 + 0.2 style rounding errors never show up. */
const cents = (n: number) => Math.round(n * 100);
export const lineTotal = (l: DraftLine) => (cents(l.product.price) * l.quantity) / 100;
export const orderTotal = (lines: DraftLine[]) => lines.reduce((s, l) => s + cents(l.product.price) * l.quantity, 0) / 100;

export interface LineIssue {
  message: string;
  /** Quantity we can offer instead (0 = remove the line). */
  fixTo: number;
}

const same = (a: unknown, b: unknown) => a !== null && a !== undefined && String(a) === String(b);

/** Which server failure belongs to this line (by product id, else SKU, else name). */
export function findFailure(line: DraftLine, failures: StockFailure[]): StockFailure | undefined {
  return failures.find(
    (f) =>
      same(f.productId, line.product.id) ||
      (!f.productId && f.sku !== "" && f.sku === line.product.sku) ||
      (!f.productId && f.sku === "" && f.name !== "" && f.name === line.product.name),
  );
}

/** The message shown under a line: the server's verdict wins over our own stock check. */
export function lineIssue(line: DraftLine, failure?: StockFailure): LineIssue | null {
  if (failure) {
    const available = failure.available ?? line.product.stock ?? 0;
    const asked = failure.requested ?? line.quantity;
    return {
      message:
        available > 0
          ? `Not enough stock: you asked for ${asked}, only ${available} available.`
          : "Out of stock: none available right now.",
      fixTo: Math.max(0, available),
    };
  }
  const { stock } = line.product;
  if (stock !== null && line.quantity > stock) {
    return { message: stock > 0 ? `Only ${stock} in stock.` : "Out of stock.", fixTo: Math.max(0, stock) };
  }
  return null;
}

/** First problem that must be fixed before the order can be reviewed, or null. */
export function validateLines(lines: DraftLine[]): string | null {
  if (lines.length === 0) return "Add at least one product to the order.";
  if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)) return "Every quantity must be a whole number of 1 or more.";
  if (lines.some((l) => lineIssue(l))) return "Some quantities are higher than the stock available. Fix the highlighted items.";
  return null;
}
