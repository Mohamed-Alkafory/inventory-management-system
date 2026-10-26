export type Id = string | number;

export interface Supplier {
  id: Id;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  isActive: boolean;
}

export interface SupplierListParams {
  search: string;
  page: number; // 1-based
  pageSize: number;
}

export interface SupplierPage {
  items: Supplier[];
  total: number;
}

export interface SupplierPayload {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
}

/** Same shape for the mock and the real API, so switching is one line. */
export interface SuppliersApi {
  list(params: SupplierListParams): Promise<SupplierPage>;
  create(values: SupplierPayload): Promise<void>;
  update(id: Id, values: SupplierPayload): Promise<void>;
  deactivate(id: Id): Promise<void>;
}
