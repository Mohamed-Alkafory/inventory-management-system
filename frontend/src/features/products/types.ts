export type Id = string | number;

export interface Option {
  id: Id;
  name: string;
}

export interface Product {
  id: Id;
  sku: string;
  name: string;
  price: number;
  costPrice?: number | null;
  categoryId: Id;
  supplierId?: Id | null;
  minStock: number;
  imageUrl?: string | null;
  barcode?: string | null;
  isActive: boolean;
  category?: Option | null;
  supplier?: Option | null;
}
