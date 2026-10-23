import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { type ListSuppliersQueryDto } from './dto/list-suppliers.query.dto.js';
import { type CreateSupplierDto } from './dto/create-supplier.dto.js';
import { SuppliersService } from './suppliers.service.js';

const SUPPLIER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('SuppliersService', () => {
  let service: SuppliersService;
  const supplierFindMany = vi.fn();
  const supplierCount = vi.fn();
  const supplierFindUnique = vi.fn();
  const supplierCreate = vi.fn();
  const supplierUpdate = vi.fn();
  /** Never expected: a hard delete would break products / purchase orders. */
  const supplierDelete = vi.fn();

  const supplierRow = (overrides: Record<string, unknown> = {}) => {
    const row: Record<string, unknown> = {
      id: SUPPLIER_ID,
      companyName: 'Office Plus Ltd.',
      email: 'sales@officeplus.com',
      phone: '+201005551234',
      address: '12 Nasr Street, Cairo',
      isActive: true,
      createdAt: new Date('2026-10-15T00:00:00Z'),
      updatedAt: new Date('2026-10-15T00:00:00Z'),
    };
    return { ...row, ...overrides };
  };

  /** Detail-read row — `SUPPLIER_DETAIL_SELECT` adds the counted relation. */
  const detailRow = (
    linkedProducts: number,
    overrides: Record<string, unknown> = {},
  ) => supplierRow({ ...overrides, _count: { products: linkedProducts } });

  beforeEach(async () => {
    supplierFindMany.mockReset();
    supplierCount.mockReset();
    supplierFindUnique.mockReset();
    supplierCreate.mockReset();
    supplierUpdate.mockReset();
    supplierDelete.mockReset();
    // Default list/meta mocks: one active supplier, no writes.
    supplierCount.mockResolvedValue(1);
    supplierFindMany.mockResolvedValue([supplierRow()]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        {
          provide: PrismaService,
          useValue: {
            supplier: {
              findMany: supplierFindMany,
              count: supplierCount,
              findUnique: supplierFindUnique,
              create: supplierCreate,
              update: supplierUpdate,
              delete: supplierDelete,
            },
          },
        },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  describe('findAll — defaults and envelope', () => {
    it('returns the contract pagination envelope with safe defaults', async () => {
      const result = await service.findAll({} as ListSuppliersQueryDto);

      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.data).toEqual([
        expect.objectContaining({
          id: SUPPLIER_ID,
          companyName: 'Office Plus Ltd.',
        }),
      ]);
      expect(supplierCount).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(supplierFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          skip: 0,
          take: 20,
          orderBy: [{ companyName: 'asc' }, { id: 'asc' }],
          select: expect.objectContaining({
            id: true,
            companyName: true,
            email: true,
          }),
        }),
      );
    });

    it('keeps the response fields compatible with the Supplier contract', async () => {
      const [row] = (await service.findAll({} as ListSuppliersQueryDto)).data;

      expect(row).toEqual({
        id: SUPPLIER_ID,
        companyName: 'Office Plus Ltd.',
        email: 'sales@officeplus.com',
        phone: '+201005551234',
        address: '12 Nasr Street, Cairo',
        isActive: true,
        createdAt: new Date('2026-10-15T00:00:00Z'),
        updatedAt: new Date('2026-10-15T00:00:00Z'),
      });
    });

    it.each([
      ['applies page and limit (skip = (page - 1) * limit)', 3, 10, 20, 10],
      ['defaults to page 1 / limit 20', undefined, undefined, 0, 20],
    ] as const)('%s', (...[, page, limit, skip, take]) => {
      const query = {
        ...(page !== undefined ? { page } : {}),
        ...(limit !== undefined ? { limit } : {}),
      } as unknown as ListSuppliersQueryDto;

      return service.findAll(query).then(() => {
        expect(supplierFindMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip, take }),
        );
      });
    });

    it('computes totalPages from the matching row count', async () => {
      supplierCount.mockResolvedValue(45);

      const result = await service.findAll({
        limit: 20,
      } as ListSuppliersQueryDto);

      expect(result.meta).toMatchObject({ total: 45, totalPages: 3 });
    });

    it('returns an empty envelope when nothing matches', async () => {
      supplierCount.mockResolvedValue(0);
      supplierFindMany.mockResolvedValue([]);

      const result = await service.findAll({
        search: 'zzz-none',
      } as ListSuppliersQueryDto);

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe('findAll — filters', () => {
    it('searches the company name case-insensitively', async () => {
      await service.findAll({ search: 'OFFICE' } as ListSuppliersQueryDto);

      const where = supplierFindMany.mock.calls[0][0].where;
      expect(where.companyName).toEqual({
        contains: 'OFFICE',
        mode: 'insensitive',
      });
      expect(supplierCount).toHaveBeenCalledWith({ where });
    });

    it('keeps the search out of the where clause when absent', async () => {
      await service.findAll({} as ListSuppliersQueryDto);

      expect(
        supplierFindMany.mock.calls[0][0].where.companyName,
      ).toBeUndefined();
    });

    it('lists soft-deleted suppliers when isActive is set to false', async () => {
      await service.findAll({ isActive: false } as ListSuppliersQueryDto);

      expect(supplierCount).toHaveBeenCalledWith({
        where: { isActive: false },
      });
    });
  });

  describe('findOne', () => {
    it('includes the product count from the counted relation', async () => {
      supplierFindUnique.mockResolvedValue(detailRow(9));

      const result = await service.findOne(SUPPLIER_ID);

      expect(supplierFindUnique).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID },
        select: expect.objectContaining({
          _count: { select: { products: true } },
        }),
      });
      expect(result).toEqual({
        id: SUPPLIER_ID,
        companyName: 'Office Plus Ltd.',
        email: 'sales@officeplus.com',
        phone: '+201005551234',
        address: '12 Nasr Street, Cairo',
        isActive: true,
        createdAt: new Date('2026-10-15T00:00:00Z'),
        updatedAt: new Date('2026-10-15T00:00:00Z'),
        productCount: 9,
      });
    });

    it('resolves soft-deleted suppliers by id', async () => {
      supplierFindUnique.mockResolvedValue(detailRow(2, { isActive: false }));

      await expect(service.findOne(SUPPLIER_ID)).resolves.toMatchObject({
        isActive: false,
      });
    });

    it('rejects unknown ids with 404 (supplier not found)', async () => {
      supplierFindUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a supplier and returns the contract shape', async () => {
      supplierCreate.mockResolvedValue(supplierRow());

      const result = await service.create({
        companyName: 'Office Plus Ltd.',
      } as CreateSupplierDto);

      expect(supplierCreate).toHaveBeenCalledWith({
        data: {
          companyName: 'Office Plus Ltd.',
          email: undefined,
          phone: undefined,
          address: undefined,
        },
        select: expect.objectContaining({ id: true, companyName: true }),
      });
      expect(result).toEqual({
        id: SUPPLIER_ID,
        companyName: 'Office Plus Ltd.',
        email: 'sales@officeplus.com',
        phone: '+201005551234',
        address: '12 Nasr Street, Cairo',
        isActive: true,
        createdAt: new Date('2026-10-15T00:00:00Z'),
        updatedAt: new Date('2026-10-15T00:00:00Z'),
      });
    });

    it('passes the contact fields through when provided', async () => {
      supplierCreate.mockResolvedValue(supplierRow());

      await service.create({
        companyName: 'Office Plus Ltd.',
        email: 'sales@officeplus.com',
        phone: '+201005551234',
        address: '12 Nasr Street, Cairo',
      } as CreateSupplierDto);

      expect(supplierCreate).toHaveBeenCalledWith({
        data: {
          companyName: 'Office Plus Ltd.',
          email: 'sales@officeplus.com',
          phone: '+201005551234',
          address: '12 Nasr Street, Cairo',
        },
        select: expect.anything(),
      });
    });
  });

  describe('update', () => {
    it('patches only the provided fields', async () => {
      supplierFindUnique.mockResolvedValue({ id: SUPPLIER_ID });
      supplierUpdate.mockResolvedValue(supplierRow());

      await service.update(SUPPLIER_ID, {
        phone: '+201111111111',
        address: null,
      } as never);

      expect(supplierUpdate).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID },
        data: { phone: '+201111111111', address: null },
        select: expect.objectContaining({ id: true }),
      });
    });

    it('keeps unchanged contact fields intact when not provided', async () => {
      supplierFindUnique.mockResolvedValue({ id: SUPPLIER_ID });
      supplierUpdate.mockResolvedValue(supplierRow());

      await service.update(SUPPLIER_ID, { isActive: false } as never);

      expect(supplierUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('rejects unknown ids with 404', async () => {
      supplierFindUnique.mockResolvedValue(null);

      await expect(
        service.update('nope', { companyName: 'X' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(supplierUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove — soft delete keeps relations intact', () => {
    it('soft-deletes via isActive = false and never hard-deletes', async () => {
      supplierFindUnique.mockResolvedValue({ id: SUPPLIER_ID });

      await expect(service.remove(SUPPLIER_ID)).resolves.toBeUndefined();

      expect(supplierUpdate).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID },
        data: { isActive: false },
        select: { id: true },
      });
      // The row (and with it every product / purchase-order FK) stays.
      expect(supplierDelete).not.toHaveBeenCalled();
    });

    it('rejects unknown ids with 404 and writes nothing', async () => {
      supplierFindUnique.mockResolvedValue(null);

      await expect(service.remove('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(supplierUpdate).not.toHaveBeenCalled();
      expect(supplierDelete).not.toHaveBeenCalled();
    });
  });
});
