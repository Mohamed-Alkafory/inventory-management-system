import type { StockStatus } from "../components/ui/StatusBadge";
import type { InventoryProduct } from "../types/inventory";

/*
  localStorage persistence for the shopping cart and favorites.
  Same guarded pattern as api/tokenStorage, so a corrupt or older payload
  simply comes back empty instead of crashing the page.
*/

type ProductDict = Record<string, unknown>;

function read<T>(key: string, validate: (rows: unknown[]) => T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? validate(parsed) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota exceeded: keep working in memory only.
  }
}

/** Leniently rebuilds a product snapshot; null when the row is beyond repair. */
function toProductSnapshot(v: ProductDict): InventoryProduct | null {
  if (typeof v.id !== "string" || typeof v.name !== "string" || typeof v.price !== "number") return null;
  return {
    id: v.id,
    name: v.name,
    sku: typeof v.sku === "string" ? v.sku : "",
    categoryId: typeof v.categoryId === "string" ? v.categoryId : "",
    supplierId: typeof v.supplierId === "string" ? v.supplierId : undefined,
    barcode: typeof v.barcode === "string" ? v.barcode : undefined,
    isActive: typeof v.isActive === "boolean" ? v.isActive : true,
    category: typeof v.category === "string" ? v.category : "",
    description: typeof v.description === "string" ? v.description : undefined,
    price: v.price,
    costPrice: typeof v.costPrice === "number" ? v.costPrice : undefined,
    stock: typeof v.stock === "number" ? v.stock : 0,
    reorderLevel: typeof v.reorderLevel === "number" ? v.reorderLevel : 0,
    status: (typeof v.status === "string" ? v.status : "in_stock") as StockStatus,
    imageUrl: typeof v.imageUrl === "string" ? v.imageUrl : undefined,
  };
}

const toInventoryProduct = (raw: unknown): InventoryProduct | null =>
  typeof raw === "object" && raw !== null ? toProductSnapshot(raw as ProductDict) : null;

export type StoredCartLine = { product: InventoryProduct; quantity: number };

export const shopStorage = {
  cartKey: "prodexa.cart.v1",
  favoritesKey: "prodexa.favorites.v1",

  readCart(): StoredCartLine[] {
    return read<StoredCartLine>(this.cartKey, (parsed) =>
      parsed.flatMap((line) => {
        const product = toInventoryProduct(line == null ? null : (line as StoredCartLine).product);
        const quantity = Math.max(1, Math.floor(Number(line && (line as StoredCartLine).quantity) || 1));
        return product ? [{ product, quantity }] : [];
      }),
    );
  },

  saveCart(lines: StoredCartLine[]): void {
    write(this.cartKey, lines);
  },

  readFavorites(): InventoryProduct[] {
    return read<InventoryProduct>(this.favoritesKey, (parsed) =>
      parsed.map(toInventoryProduct).filter((p): p is InventoryProduct => p !== null),
    );
  },

  saveFavorites(products: InventoryProduct[]): void {
    write(this.favoritesKey, products);
  },

  /** Mostly for tests. */
  clearAll(): void {
    try {
      localStorage.removeItem(this.cartKey);
      localStorage.removeItem(this.favoritesKey);
    } catch {
      /* ignore */
    }
  },
};
