import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { ListSuppliersQueryDto } from './dto/list-suppliers.query.dto.js';

/** Contract `Supplier` shape. */
export interface SupplierResponse {
  id: string;
  companyName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** `GET /suppliers/:id` — the supplier plus the number of linked products. */
export interface SupplierDetailResponse extends SupplierResponse {
  productCount: number;
}

/** List response — §1 pagination envelope. */
export interface SupplierListResponse {
  data: SupplierResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const SUPPLIER_SELECT = {
  id: true,
  companyName: true,
  email: true,
  phone: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupplierSelect;

/** Detail read counts linked products in the same query (`_count`). */
const SUPPLIER_DETAIL_SELECT = {
  ...SUPPLIER_SELECT,
  _count: { select: { products: true } },
} satisfies Prisma.SupplierSelect;

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paginated, searchable supplier list. Active suppliers only by default
   * (AD-001 — soft-deleted rows disappear from the listing; they still
   * resolve by id) — an explicit `isActive` query param overrides that.
   * Fixed alphabetical ordering keeps pickers stable; the secondary `id`
   * sort breaks ties deterministically.
   */
  async findAll(query: ListSuppliersQueryDto): Promise<SupplierListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.SupplierWhereInput = {
      isActive: query.isActive ?? true,
      ...(query.search
        ? { companyName: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [total, suppliers] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ companyName: 'asc' }, { id: 'asc' }],
        select: SUPPLIER_SELECT,
      }),
    ]);

    return this.toPage(suppliers, total, page, limit);
  }

  /**
   * Detail by id, including how many products reference the supplier.
   * Inactive (soft-deleted) suppliers still resolve — the list hides them,
   * AD-001 keeps them resolvable for history/reference — and `isActive`
   * plus the count let clients render the state.
   */
  async findOne(id: string): Promise<SupplierDetailResponse> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      select: SUPPLIER_DETAIL_SELECT,
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }

    const { _count, ...rest } = supplier;
    return { ...rest, productCount: _count.products };
  }

  async create(dto: CreateSupplierDto): Promise<SupplierResponse> {
    return this.prisma.supplier.create({
      data: {
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
      },
      select: SUPPLIER_SELECT,
    });
  }

  /** Partial update; contact fields become `null` when cleared (PATCH `null`). */
  async update(id: string, dto: UpdateSupplierDto): Promise<SupplierResponse> {
    const where = { id };
    const existing = await this.prisma.supplier.findUnique({
      where,
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }

    const data: Prisma.SupplierUncheckedUpdateInput = {};
    if (dto.companyName !== undefined) {
      data.companyName = dto.companyName;
    }
    if (dto.email !== undefined) {
      data.email = dto.email;
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone;
    }
    if (dto.address !== undefined) {
      data.address = dto.address;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    return this.prisma.supplier.update({
      where,
      data,
      select: SUPPLIER_SELECT,
    });
  }

  /**
   * AD-001 soft delete: set `isActive = false`, never remove the row — so
   * every linked product and purchase order keeps its `supplier_id` FK
   * reference (ON DELETE RESTRICT) intact. Idempotent-ish: deactivating
   * twice keeps `isActive = false`.
   */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.supplier.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }

    await this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
      select: { id: true },
    });
  }

  private toPage(
    data: SupplierResponse[],
    total: number,
    page: number,
    limit: number,
  ): SupplierListResponse {
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
