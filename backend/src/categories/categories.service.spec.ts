import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { type ListCategoriesQueryDto } from './dto/list-categories.query.dto.js';
import { type CreateCategoryDto } from './dto/create-category.dto.js';
import { CategoriesService } from './categories.service.js';

const CATEGORY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('CategoriesService', () => {
  let service: CategoriesService;
  const categoryFindMany = vi.fn();
  const categoryCount = vi.fn();
  const categoryFindUnique = vi.fn();
  const categoryCreate = vi.fn();
  const categoryUpdate = vi.fn();
  const productCount = vi.fn();

  const categoryRow = (overrides: Record<string, unknown> = {}) => {
    const row: Record<string, unknown> = {
      id: CATEGORY_ID,
      name: 'Electronics',
      description: 'Devices and accessories',
      isActive: true,
      createdAt: new Date('2026-10-15T00:00:00Z'),
      updatedAt: new Date('2026-10-15T00:00:00Z'),
    };
    return { ...row, ...overrides };
  };

  /** Detail-read row — `CATEGORY_DETAIL_SELECT` adds the counted relation. */
  const detailRow = (
    linkedProducts: number,
    overrides: Record<string, unknown> = {},
  ) => categoryRow({ ...overrides, _count: { products: linkedProducts } });

  beforeEach(async () => {
    categoryFindMany.mockReset();
    categoryCount.mockReset();
    categoryFindUnique.mockReset();
    categoryCreate.mockReset();
    categoryUpdate.mockReset();
    productCount.mockReset();
    // Default list/detail mocks: one active category, no duplicates.
    categoryCount.mockResolvedValue(1);
    categoryFindMany.mockResolvedValue([categoryRow()]);
    productCount.mockResolvedValue(0);
    categoryUpdate.mockResolvedValue(categoryRow());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: {
            category: {
              findMany: categoryFindMany,
              count: categoryCount,
              findUnique: categoryFindUnique,
              create: categoryCreate,
              update: categoryUpdate,
            },
            product: { count: productCount },
          },
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('findAll — defaults and envelope', () => {
    it('returns the contract pagination envelope with safe defaults', async () => {
      const result = await service.findAll({} as ListCategoriesQueryDto);

      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.data).toEqual([
        expect.objectContaining({ id: CATEGORY_ID, name: 'Electronics' }),
      ]);
      expect(categoryCount).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(categoryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          skip: 0,
          take: 20,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          select: expect.objectContaining({ id: true, name: true }),
        }),
      );
    });

    it('keeps the response fields compatible with the Category contract', async () => {
      const [row] = (await service.findAll({} as ListCategoriesQueryDto)).data;

      expect(row).toEqual({
        id: CATEGORY_ID,
        name: 'Electronics',
        description: 'Devices and accessories',
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
      } as unknown as ListCategoriesQueryDto;

      return service.findAll(query).then(() => {
        expect(categoryFindMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip, take }),
        );
      });
    });

    it('computes totalPages from the matching row count', async () => {
      categoryCount.mockResolvedValue(45);

      const result = await service.findAll({
        limit: 20,
      } as ListCategoriesQueryDto);

      expect(result.meta).toMatchObject({ total: 45, totalPages: 3 });
    });

    it('returns an empty envelope when nothing matches', async () => {
      categoryCount.mockResolvedValue(0);
      categoryFindMany.mockResolvedValue([]);

      const result = await service.findAll({
        search: 'zzz-none',
      } as ListCategoriesQueryDto);

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
    it('searches name and description case-insensitively', async () => {
      await service.findAll({ search: 'ELEC' } as ListCategoriesQueryDto);

      const call = categoryFindMany.mock.calls[0][0];
      expect(call.where.OR).toEqual([
        { name: { contains: 'ELEC', mode: 'insensitive' } },
        { description: { contains: 'ELEC', mode: 'insensitive' } },
      ]);
      expect(categoryCount).toHaveBeenCalledWith({ where: call.where });
    });

    it('keeps the search out of the where clause when absent', async () => {
      await service.findAll({} as ListCategoriesQueryDto);

      expect(categoryFindMany.mock.calls[0][0].where.OR).toBeUndefined();
    });

    it('lists soft-deleted categories when isActive is set to false', async () => {
      await service.findAll({ isActive: false } as ListCategoriesQueryDto);

      expect(categoryCount).toHaveBeenCalledWith({
        where: { isActive: false },
      });
    });
  });

  describe('findOne', () => {
    it('includes the product count from the counted relation', async () => {
      categoryFindUnique.mockResolvedValue(detailRow(7));

      const result = await service.findOne(CATEGORY_ID);

      expect(categoryFindUnique).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
        select: expect.objectContaining({
          _count: { select: { products: true } },
        }),
      });
      expect(result).toEqual({
        id: CATEGORY_ID,
        name: 'Electronics',
        description: 'Devices and accessories',
        isActive: true,
        createdAt: new Date('2026-10-15T00:00:00Z'),
        updatedAt: new Date('2026-10-15T00:00:00Z'),
        productCount: 7,
      });
    });

    it('resolves soft-deleted categories by id', async () => {
      categoryFindUnique.mockResolvedValue(detailRow(2, { isActive: false }));

      await expect(service.findOne(CATEGORY_ID)).resolves.toMatchObject({
        isActive: false,
      });
    });

    it('rejects unknown ids with 404 (category not found)', async () => {
      categoryFindUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const validCreateDto: CreateCategoryDto = {
      name: 'Electronics',
      description: 'Devices and accessories',
    } as never;

    it('creates a category and returns the contract shape', async () => {
      categoryFindUnique.mockResolvedValue(null);
      categoryCreate.mockResolvedValue(categoryRow());

      const result = await service.create(validCreateDto);

      expect(categoryCreate).toHaveBeenCalledWith({
        data: { name: 'Electronics', description: 'Devices and accessories' },
        select: expect.objectContaining({
          id: true,
          name: true,
          isActive: true,
        }),
      });
      expect(result).toEqual({
        id: CATEGORY_ID,
        name: 'Electronics',
        description: 'Devices and accessories',
        isActive: true,
        createdAt: new Date('2026-10-15T00:00:00Z'),
        updatedAt: new Date('2026-10-15T00:00:00Z'),
      });
    });

    it('defaults the description to null when omitted', async () => {
      categoryFindUnique.mockResolvedValue(null);
      categoryCreate.mockResolvedValue(categoryRow({ description: null }));

      const result = await service.create({ name: 'Apparel' } as never);

      expect(categoryCreate).toHaveBeenCalledWith({
        data: { name: 'Apparel', description: undefined },
        select: expect.anything(),
      });
      expect(result.description).toBeNull();
    });

    it('rejects a duplicate name with 409 before any write', async () => {
      categoryFindUnique.mockResolvedValue({ id: 'other-id' });

      await expect(service.create(validCreateDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.create(validCreateDto)).rejects.toThrow(
        'already exists',
      );
      expect(categoryFindUnique).toHaveBeenCalledWith({
        where: { name: 'Electronics' },
        select: { id: true },
      });
      expect(categoryCreate).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('patches only the provided fields', async () => {
      categoryFindUnique
        .mockResolvedValueOnce(categoryRow()) // existence check by id
        .mockResolvedValueOnce(null); // the fresh name is still available
      categoryUpdate.mockResolvedValue(categoryRow({ name: ' renamed ' }));

      await service.update(CATEGORY_ID, {
        name: ' renamed ',
        description: null,
      } as never);

      expect(categoryUpdate).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
        data: { name: ' renamed ', description: null },
        select: expect.objectContaining({ id: true }),
      });
    });

    it('skips the name check when the name is unchanged', async () => {
      categoryFindUnique.mockResolvedValue(categoryRow());

      await service.update(CATEGORY_ID, { name: 'Electronics' } as never);

      // findUnique is called once (existence check), and not again for the
      // duplicate-name pre-check.
      expect(categoryFindUnique).toHaveBeenCalledTimes(1);
    });

    it('rejects renaming to a name taken by another category with 409', async () => {
      categoryFindUnique
        .mockResolvedValueOnce(categoryRow()) // existence check by id
        .mockResolvedValueOnce({ id: 'another-id' }); // name taken

      await expect(
        service.update(CATEGORY_ID, { name: 'Apparel' } as never),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(categoryUpdate).not.toHaveBeenCalled();
    });

    it('keeps an unchanged description intact when not provided', async () => {
      categoryFindUnique.mockResolvedValue(categoryRow());

      await service.update(CATEGORY_ID, { isActive: false } as never);

      expect(categoryUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('rejects unknown ids with 404', async () => {
      categoryFindUnique.mockResolvedValue(null);

      await expect(
        service.update('nope', { name: 'X' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(categoryUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove — linked products guard and soft delete', () => {
    it('rejects with 409 when products are still linked and writes nothing', async () => {
      categoryFindUnique.mockResolvedValue({ id: CATEGORY_ID });
      productCount.mockResolvedValue(12);

      await expect(service.remove(CATEGORY_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.remove(CATEGORY_ID)).rejects.toThrow(
        /12 linked product/,
      );
      expect(productCount).toHaveBeenCalledWith({
        where: { categoryId: CATEGORY_ID },
      });
      // The row — and with it every product relation — is left untouched.
      expect(categoryUpdate).not.toHaveBeenCalled();
    });

    it('soft-deletes (isActive = false) when no products reference it', async () => {
      categoryFindUnique.mockResolvedValue({ id: CATEGORY_ID });
      productCount.mockResolvedValue(0);

      await expect(service.remove(CATEGORY_ID)).resolves.toBeUndefined();

      expect(categoryUpdate).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
        data: { isActive: false },
        select: { id: true },
      });
    });

    it('rejects unknown ids with 404 and never counts or writes', async () => {
      categoryFindUnique.mockResolvedValue(null);

      await expect(service.remove('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(productCount).not.toHaveBeenCalled();
      expect(categoryUpdate).not.toHaveBeenCalled();
    });
  });
});
