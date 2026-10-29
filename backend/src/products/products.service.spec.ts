import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { type CreateProductDto } from './dto/create-product.dto.js';
import { type ListProductsQueryDto } from './dto/list-products.query.dto.js';
import { type UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';
import {
  ImageStorageService,
  type UploadedImageFile,
} from '../storage/image-storage.service.js';

const CATEGORY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SUPPLIER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('ProductsService', () => {
  let service: ProductsService;
  const log = vi.fn();
  const productFindMany = vi.fn();
  const productCount = vi.fn();
  const productFindUnique = vi.fn();
  const productCreate = vi.fn();
  const productUpdate = vi.fn();
  const $queryRaw = vi.fn();
  const categoryFindUnique = vi.fn();
  const supplierFindUnique = vi.fn();
  const imageSave = vi.fn();
  const imageDelete = vi.fn();

  const productRow = (overrides: Record<string, unknown> = {}) => {
    const row: Record<string, unknown> = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      sku: 'OFF-PEN-002',
      name: 'Ballpoint Pen',
      description: null,
      imageUrl: null,
      barcode: null,
      price: new Prisma.Decimal('1.99'),
      costPrice: new Prisma.Decimal('0.60'),
      quantity: 500,
      minStock: 50,
      isActive: true,
      categoryId: CATEGORY_ID,
      supplierId: SUPPLIER_ID,
      createdAt: new Date('2026-10-15T00:00:00Z'),
      updatedAt: new Date('2026-10-15T00:00:00Z'),
    };
    return { ...row, ...overrides } as Prisma.ProductGetPayload<{
      select: Record<string, true>;
    }>;
  };

  beforeEach(async () => {
    productFindMany.mockReset();
    productCount.mockReset();
    productFindUnique.mockReset();
    productCreate.mockReset();
    productUpdate.mockReset();
    log.mockReset();
    $queryRaw.mockReset();
    categoryFindUnique.mockReset();
    supplierFindUnique.mockReset();
    imageSave.mockReset();
    imageDelete.mockReset();
    imageSave.mockResolvedValue('/uploads/products/new-image.png');
    imageDelete.mockResolvedValue(undefined);
    // FK lookups "succeed" unless a test says otherwise.
    categoryFindUnique.mockResolvedValue({ id: CATEGORY_ID });
    supplierFindUnique.mockResolvedValue({ id: SUPPLIER_ID });
    productUpdate.mockResolvedValue(productRow());
    // Default list mocks: one matching product.
    productCount.mockResolvedValue(1);
    productFindMany.mockResolvedValue([productRow()]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: AuditService, useValue: { log } },
        {
          provide: ImageStorageService,
          useValue: { save: imageSave, delete: imageDelete },
        },
        {
          provide: PrismaService,
          useValue: {
            product: {
              findMany: productFindMany,
              count: productCount,
              findUnique: productFindUnique,
              create: productCreate,
              update: productUpdate,
            },
            $queryRaw,
            category: { findUnique: categoryFindUnique },
            supplier: { findUnique: supplierFindUnique },
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findAll — defaults and envelope', () => {
    it('returns the contract pagination envelope with safe defaults', async () => {
      const result = await service.findAll({} as ListProductsQueryDto, 'ADMIN');

      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.data[0]).toMatchObject({
        sku: 'OFF-PEN-002',
        price: 1.99,
        quantity: 500,
      });
      expect(productCount).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          skip: 0,
          take: 20,
          // Default sort (contract: createdAt desc) + deterministic id tie-break.
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          select: expect.objectContaining({ id: true, sku: true, price: true }),
        }),
      );
    });

    it('keeps the response fields compatible; no extra queries per page', async () => {
      const [row] = (await service.findAll({} as ListProductsQueryDto, 'ADMIN'))
        .data;

      expect(row).toEqual({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        sku: 'OFF-PEN-002',
        name: 'Ballpoint Pen',
        description: null,
        imageUrl: null,
        barcode: null,
        price: 1.99,
        costPrice: 0.6,
        quantity: 500,
        minStock: 50,
        isActive: true,
        categoryId: CATEGORY_ID,
        supplierId: SUPPLIER_ID,
        createdAt: new Date('2026-10-15T00:00:00Z'),
        updatedAt: new Date('2026-10-15T00:00:00Z'),
      });
      // Category/supplier come from the select, not extra queries.
      expect(categoryFindUnique).not.toHaveBeenCalled();
      expect(supplierFindUnique).not.toHaveBeenCalled();
    });

    it('applies page and limit (skip = (page - 1) * limit)', async () => {
      await service.findAll(
        { page: 3, limit: 10 } as ListProductsQueryDto,
        'ADMIN',
      );

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('returns an empty list with totalPages 0 when nothing matches', async () => {
      productCount.mockResolvedValue(0);
      productFindMany.mockResolvedValue([]);

      const result = await service.findAll({} as ListProductsQueryDto, 'ADMIN');

      expect(result).toEqual({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });

    it('returns an empty list (not an error) when the page is beyond the last', async () => {
      productCount.mockResolvedValue(3);
      productFindMany.mockResolvedValue([]);

      const result = await service.findAll(
        { page: 5, limit: 20 } as ListProductsQueryDto,
        'ADMIN',
      );

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        page: 5,
        limit: 20,
        total: 3,
        totalPages: 1,
      });
    });
  });

  describe('findAll — filters and sorting', () => {
    it('searches name and SKU case-insensitively', async () => {
      await service.findAll({ search: 'pen' } as ListProductsQueryDto, 'ADMIN');

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            OR: [
              { name: { contains: 'pen', mode: 'insensitive' } },
              { sku: { contains: 'pen', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('combines categoryId, supplierId and isActive filters', async () => {
      await service.findAll(
        {
          categoryId: CATEGORY_ID,
          supplierId: SUPPLIER_ID,
          isActive: false,
        } as ListProductsQueryDto,
        'ADMIN',
      );

      expect(productCount).toHaveBeenCalledWith({
        where: {
          isActive: false,
          categoryId: CATEGORY_ID,
          supplierId: SUPPLIER_ID,
        },
      });
      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: false,
            categoryId: CATEGORY_ID,
            supplierId: SUPPLIER_ID,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        }),
      );
    });

    it('filters in_stock (quantity > 0)', async () => {
      await service.findAll(
        { stockStatus: 'in_stock' } as ListProductsQueryDto,
        'ADMIN',
      );

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, quantity: { gt: 0 } },
        }),
      );
    });

    it('filters out_of_stock (quantity = 0)', async () => {
      await service.findAll(
        { stockStatus: 'out_of_stock' } as ListProductsQueryDto,
        'ADMIN',
      );

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, quantity: { equals: 0 } },
        }),
      );
    });

    it.each([
      ['name', 'name'],
      ['sku', 'sku'],
      ['price', 'price'],
      ['quantity', 'quantity'],
      ['createdAt', 'createdAt'],
    ])('sorts by %s whitelisted', async (sortBy, column) => {
      await service.findAll(
        { sortBy, sortOrder: 'asc' } as ListProductsQueryDto,
        'ADMIN',
      );

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ [column]: 'asc' }, { id: 'asc' }],
        }),
      );
    });
  });

  describe('findAll — stockStatus=low_stock (raw query)', () => {
    it('compares quantity <= minStock with a whitelisted raw ORDER BY', async () => {
      $queryRaw
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([productRow()]);

      const result = await service.findAll(
        { stockStatus: 'low_stock' } as ListProductsQueryDto,
        'ADMIN',
      );

      // One raw SELECT for the matching count, one for the page rows.
      expect($queryRaw).toHaveBeenCalledTimes(2);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.data[0].price).toBe(1.99);
    });

    it('keeps costPrice ADMIN-only on the raw path and hides it for STAFF', async () => {
      $queryRaw
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([productRow()]);

      const adminResult = await service.findAll(
        { stockStatus: 'low_stock' } as ListProductsQueryDto,
        'ADMIN',
      );
      expect(adminResult.data[0].costPrice).toBe(0.6);

      $queryRaw.mockReset();
      $queryRaw
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([productRow()]);

      const staffResult = await service.findAll(
        { stockStatus: 'low_stock' } as ListProductsQueryDto,
        'STAFF',
      );
      expect(staffResult.data[0]).not.toHaveProperty('costPrice');
    });
  });

  describe('findAll — costPrice visibility (AD-004)', () => {
    it('hides costPrice for STAFF and returns it for ADMIN', async () => {
      const staffResult = await service.findAll(
        {} as ListProductsQueryDto,
        'STAFF',
      );
      expect(staffResult.data[0]).not.toHaveProperty('costPrice');

      const adminResult = await service.findAll(
        {} as ListProductsQueryDto,
        'ADMIN',
      );
      expect(adminResult.data[0].costPrice).toBe(0.6);
    });

    it('returns a null costPrice as null for ADMIN', async () => {
      productFindMany.mockResolvedValue([productRow({ costPrice: null })]);

      const result = await service.findAll({} as ListProductsQueryDto, 'ADMIN');

      expect(result.data[0]).toHaveProperty('costPrice', null);
    });
  });

  describe('findOne', () => {
    it('returns the product when it exists', async () => {
      productFindUnique.mockResolvedValue(productRow());

      await expect(
        service.findOne('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ADMIN'),
      ).resolves.toMatchObject({ sku: 'OFF-PEN-002', price: 1.99 });
    });

    it('throws 404 when the product does not exist', async () => {
      productFindUnique.mockResolvedValue(null);

      await expect(
        service.findOne('missing-id', 'ADMIN'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('still resolves soft-deleted (inactive) products with isActive: false (AD-001)', async () => {
      productFindUnique.mockResolvedValue(productRow({ isActive: false }));

      const result = await service.findOne('aaaa', 'STAFF');

      expect(result.isActive).toBe(false);
      expect(result).not.toHaveProperty('costPrice');
    });
  });

  describe('create', () => {
    it('creates the product and returns it serialized for ADMIN', async () => {
      productCreate.mockResolvedValue(productRow());

      const result = await service.create(validCreateDto());

      expect(result.costPrice).toBe(0.6);
      expect(productCreate).toHaveBeenCalledWith({
        data: {
          sku: 'OFF-PEN-002',
          name: 'Ballpoint Pen',
          description: 'Blue ink',
          imageUrl: 'https://example.com/pen.png',
          barcode: '8901234567890',
          price: 1.99,
          costPrice: 0.6,
          quantity: 500,
          minStock: 50,
          categoryId: CATEGORY_ID,
          supplierId: SUPPLIER_ID,
        },
        select: expect.anything(),
      });
    });

    it('throws 404 when the category does not exist', async () => {
      categoryFindUnique.mockResolvedValue(null);

      await expect(service.create(validCreateDto())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(productCreate).not.toHaveBeenCalled();
    });

    it('throws 404 when the supplier does not exist', async () => {
      supplierFindUnique.mockResolvedValue(null);

      await expect(service.create(validCreateDto())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(productCreate).not.toHaveBeenCalled();
    });

    it('skips the supplier lookup when no supplierId is sent', async () => {
      productCreate.mockResolvedValue(productRow());

      await service.create(validCreateDto({ supplierId: undefined }));

      expect(supplierFindUnique).not.toHaveBeenCalled();
    });

    it('treats supplierId: null as "no supplier" instead of a lookup', async () => {
      productCreate.mockResolvedValue(productRow());

      await service.create(validCreateDto({ supplierId: null }));

      expect(supplierFindUnique).not.toHaveBeenCalled();
      expect(productCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ supplierId: null }),
        }),
      );
    });

    it('lets duplicate sku/barcode surface as a Prisma P2002 (409 via the global filter)', async () => {
      productCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.create(validCreateDto())).rejects.toMatchObject({
        code: 'P2002',
      });
      expect(productCreate).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('applies only the provided fields and never quantity/isActive', async () => {
      productFindUnique.mockResolvedValue(productRow());
      productUpdate.mockResolvedValue(
        productRow({ price: new Prisma.Decimal('2.49') }),
      );

      // `quantity`/`isActive` are not part of UpdateProductDto; assert the
      // data payload contains exactly the provided fields.
      const result = await service.update(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        { name: 'Renamed Pen' } as UpdateProductDto,
      );

      expect(result.name).toBe('Ballpoint Pen');
      expect(productUpdate).toHaveBeenCalledWith({
        where: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        data: { name: 'Renamed Pen' },
        select: expect.objectContaining({ sku: true, costPrice: true }),
      });
    });

    it('throws 404 when the product does not exist', async () => {
      productFindUnique.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { name: 'X' } as UpdateProductDto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(productUpdate).not.toHaveBeenCalled();
    });

    it('records the old and new price in the audit trail (#34)', async () => {
      productFindUnique.mockResolvedValue(productRow());
      productUpdate.mockResolvedValue(
        productRow({ price: new Prisma.Decimal('2.49') }),
      );

      await service.update(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        { price: 2.49 } as UpdateProductDto,
        'user-1',
      );

      const entry = log.mock.calls.at(-1)?.[0];
      expect(entry).toMatchObject({
        userId: 'user-1',
        action: 'product.updated',
        entityType: 'product',
        entityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      });
      expect(Number(entry.oldValues.price)).toBe(1.99);
      expect(Number(entry.newValues.price)).toBe(2.49);
    });

    it('throws 404 when the new category does not exist', async () => {
      productFindUnique.mockResolvedValue(productRow());
      categoryFindUnique.mockResolvedValue(null);

      await expect(
        service.update('aaa', { categoryId: 'nope' } as UpdateProductDto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(productUpdate).not.toHaveBeenCalled();
    });

    it('throws 404 when the new supplier does not exist', async () => {
      productFindUnique.mockResolvedValue(productRow());
      supplierFindUnique.mockResolvedValue(null);

      await expect(
        service.update('aaa', { supplierId: 'nope' } as UpdateProductDto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(productUpdate).not.toHaveBeenCalled();
    });

    it('allows nulling supplierId/barcode without an FK lookup', async () => {
      productFindUnique.mockResolvedValue(productRow());
      productUpdate.mockResolvedValue(productRow());

      await service.update('aaa', {
        supplierId: null,
        barcode: null,
      } as UpdateProductDto);

      expect(supplierFindUnique).not.toHaveBeenCalled();
      expect(productUpdate).toHaveBeenCalledWith({
        where: { id: 'aaa' },
        data: { supplierId: null, barcode: null },
        select: expect.anything(),
      });
    });

    it('lets duplicate sku surface as a Prisma P2002 (409 via the global filter)', async () => {
      productFindUnique.mockResolvedValue(productRow());
      productUpdate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.update('aaa', { sku: 'TAKEN' } as UpdateProductDto),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('remove (soft delete, AD-001)', () => {
    it('sets isActive=false and never deletes the row', async () => {
      productFindUnique.mockResolvedValue(productRow());

      await expect(
        service.remove('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      ).resolves.toBeUndefined();

      expect(productUpdate).toHaveBeenCalledWith({
        where: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        data: { isActive: false },
        select: { id: true },
      });
      expect(productCreate).not.toHaveBeenCalled();
    });

    it('throws 404 when the product does not exist', async () => {
      productFindUnique.mockResolvedValue(null);

      await expect(service.remove('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(productUpdate).not.toHaveBeenCalled();
    });
  });

  describe('image upload', () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const file: UploadedImageFile = {
      buffer: Buffer.from('image'),
      size: 5,
      mimetype: 'image/png',
      originalname: 'client-name.png',
    };

    it('stores the new URL, removes the previous local file and audits it', async () => {
      const oldRow = productRow({
        imageUrl: '/uploads/products/old.png',
      });
      productFindUnique.mockResolvedValue(oldRow);
      productUpdate.mockResolvedValue(
        productRow({ imageUrl: '/uploads/products/new-image.png' }),
      );

      const result = await service.uploadImage(id, file, 'admin-id');

      expect(result.imageUrl).toBe('/uploads/products/new-image.png');
      expect(imageSave).toHaveBeenCalledWith(file, 'products');
      expect(productUpdate).toHaveBeenCalledWith({
        where: { id },
        data: { imageUrl: '/uploads/products/new-image.png' },
        select: expect.anything(),
      });
      expect(imageDelete).toHaveBeenCalledWith('/uploads/products/old.png');
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'product.image_updated',
          entityId: id,
          oldValues: oldRow,
        }),
      );
    });

    it('deletes the newly written file when the DB update fails', async () => {
      productFindUnique.mockResolvedValue(productRow());
      productUpdate.mockRejectedValue(new Error('db down'));

      await expect(service.uploadImage(id, file, 'admin-id')).rejects.toThrow(
        'db down',
      );

      expect(imageDelete).toHaveBeenCalledTimes(1);
      expect(imageDelete).toHaveBeenCalledWith('/uploads/products/new-image.png');
    });

    it('throws 404 when the product does not exist', async () => {
      productFindUnique.mockResolvedValue(null);

      await expect(service.uploadImage(id, file, 'admin-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(imageSave).not.toHaveBeenCalled();
    });

    it('works for inactive products, matching the existing update behaviour', async () => {
      productFindUnique.mockResolvedValue(productRow({ isActive: false }));
      productUpdate.mockResolvedValue(
        productRow({ isActive: false, imageUrl: '/uploads/products/new-image.png' }),
      );

      await expect(
        service.uploadImage(id, file, 'admin-id'),
      ).resolves.toMatchObject({ isActive: false });
    });
  });

  describe('image deletion', () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    it('clears imageUrl and removes the old local file', async () => {
      const oldRow = productRow({ imageUrl: '/uploads/products/old.png' });
      productFindUnique.mockResolvedValue(oldRow);
      productUpdate.mockResolvedValue(productRow({ imageUrl: null }));

      await expect(service.removeImage(id, 'admin-id')).resolves.toBeUndefined();

      expect(productUpdate).toHaveBeenCalledWith({
        where: { id },
        data: { imageUrl: null },
        select: expect.anything(),
      });
      expect(imageDelete).toHaveBeenCalledWith('/uploads/products/old.png');
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'product.image_deleted',
          entityId: id,
        }),
      );
    });

    it('throws 404 when the product does not exist', async () => {
      productFindUnique.mockResolvedValue(null);

      await expect(service.removeImage(id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(productUpdate).not.toHaveBeenCalled();
    });
  });

  function validCreateDto(
    overrides: Partial<CreateProductDto> = {},
  ): CreateProductDto {
    const dto: CreateProductDto = {
      sku: 'OFF-PEN-002',
      name: 'Ballpoint Pen',
      description: 'Blue ink',
      imageUrl: 'https://example.com/pen.png',
      barcode: '8901234567890',
      price: 1.99,
      costPrice: 0.6,
      quantity: 500,
      minStock: 50,
      categoryId: CATEGORY_ID,
      supplierId: SUPPLIER_ID,
    };
    return { ...dto, ...overrides };
  }
});
