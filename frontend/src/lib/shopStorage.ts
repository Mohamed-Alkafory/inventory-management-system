import type { CartItem, ShopProduct } from "../types/shop";

/*
  localStorage persistence for the shopping cart and favorites.
  Only customer-safe catalog fields are stored — never sku, cost, exact stock,
  supplier or barcode. Older payloads (built from the internal inventory shape)
  are sanitised on read: unknown fields are dropped and unusable rows discarded.
*/

type Dict = Record<string, unknown>;

/** Backend limits for POST /orders/mine: 30 distinct products, 50 per line. */
export const MAX_CART_PRODUCTS = 30;
export const MAX_LINE_QUANTITY = 50;

const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined);
const num = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};

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

function write(key: string, value: unknown[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota exceeded: keep working in memory only.
  }
}

/**
 * Rebuilds the catalog snapshot. Accepts the current shape and the legacy
 * inventory snapshot (where `stock` was stored): `stock` becomes `maxOrderable`.
 */
function toShopProduct(raw: unknown): ShopProduct | null {
  if (!isDict(raw)) return null;

  const id = str(raw.id);
  const name = str(raw.name);
  const price = num(raw.price);
  if (!id || !name || price === undefined) return null;

  const rawCategory = raw.category;
  const category = (isDict(rawCategory) ? str(rawCategory.name) : str(rawCategory)) ?? "";
  const categoryId = isDict(rawCategory) ? str(rawCategory.id) : str(raw.categoryId);

  const maxOrderable = Math.max(0, Math.floor(num(raw.maxOrderable) ?? num(raw.stock) ?? 0));

  return {
    id,
    name,
    price,
    imageUrl: str(raw.imageUrl),
    category,
    categoryId,
    inStock: maxOrderable > 0,
    maxOrderable,
  };
}

/** The only fields written to localStorage. */
function toSnapshot(product: ShopProduct): Dict {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    maxOrderable: product.maxOrderable,
    category: product.category,
  };
}

const toCartLine = (raw: unknown): CartItem | null => {
  if (!isDict(raw)) return null;
  const product = toShopProduct(raw.product);
  if (!product || product.maxOrderable <= 0) return null;

  const quantity = Math.max(1, Math.floor(num(raw.quantity) ?? 1));
  return {
    product,
    quantity: Math.min(quantity, product.maxOrderable, MAX_LINE_QUANTITY),
  };
};

export const shopStorage = {
  cartKey: "prodexa.cart.v1",
  favoritesKey: "prodexa.favorites.v1",

  readCart(): CartItem[] {
    return read<CartItem>(this.cartKey, (parsed) =>
      parsed.map(toCartLine).filter((line): line is CartItem => line !== null),
    );
  },

  saveCart(lines: CartItem[]): void {
    write(
      this.cartKey,
      lines.map((line) => ({ product: toSnapshot(line.product), quantity: line.quantity })),
    );
  },

  readFavorites(): ShopProduct[] {
    return read<ShopProduct>(this.favoritesKey, (parsed) => {
      const seen = new Set<string>();
      return parsed.flatMap((row) => {
        const product = toShopProduct(row);
        if (!product || seen.has(product.id)) return [];
        seen.add(product.id);
        return [product];
      });
    });
  },

  saveFavorites(products: ShopProduct[]): void {
    write(this.favoritesKey, products.map(toSnapshot));
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
