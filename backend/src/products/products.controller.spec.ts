import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ProductsController } from './products.controller.js';
import {
  ProductsService,
  type ProductListResponse,
  type ProductResponse,
} from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products.query.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator.js';

const ADMIN = { sub: 'admin-id', role: 'ADMIN' } as const;
const STAFF = { sub: 'staff-id', role: 'STAFF' } as const;

const sampleProduct: ProductResponse = {
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
  categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  supplierId: null,
  createdAt: new Date('2026-10-15T00:00:00Z'),
  updatedAt: new Date('2026-10-15T00:00:00Z'),
};

const samplePage: ProductListResponse = {
  data: [sampleProduct],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const emptyPage: ProductListResponse = {
  data: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

describe('ProductsController', () => {
  let controller: ProductsController;
  let reflector: Reflector;
  const findAll = vi.fn();
  const findOne = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const remove = vi.fn();
  const uploadImage = vi.fn();
  const removeImage = vi.fn();

  beforeEach(async () => {
    findAll.mockReset();
    findOne.mockReset();
    create.mockReset();
    update.mockReset();
    remove.mockReset();
    uploadImage.mockReset();
    removeImage.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: {
            findAll,
            findOne,
            create,
            update,
            remove,
            uploadImage,
            removeImage,
          },
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    reflector = module.get(Reflector);
  });

  it('returns the paginated envelope provided by the service', async () => {
    findAll.mockResolvedValue(samplePage);
    const query = { page: 2, limit: 10 } as ListProductsQueryDto;

    await expect(controller.findAll(query, ADMIN)).resolves.toEqual(samplePage);
    expect(findAll).toHaveBeenCalledWith(query, 'ADMIN');
  });

  it('returns an empty envelope when nothing matches', async () => {
    findAll.mockResolvedValue(emptyPage);
    const query = { search: 'zzz-none' } as ListProductsQueryDto;

    await expect(controller.findAll(query, ADMIN)).resolves.toEqual(emptyPage);
  });

  it('passes the requester role for costPrice filtering', async () => {
    findAll.mockResolvedValue(emptyPage);
    findOne.mockResolvedValue(sampleProduct);
    const query = {} as ListProductsQueryDto;

    await controller.findAll(query, STAFF);
    await controller.findOne('some-id', STAFF);

    expect(findAll).toHaveBeenCalledWith(query, 'STAFF');
    expect(findOne).toHaveBeenCalledWith('some-id', 'STAFF');
  });

  it('forwards each list filter to the service', async () => {
    findAll.mockResolvedValue(emptyPage);
    const query = {
      search: 'pen',
      categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      supplierId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      isActive: false,
      stockStatus: 'low_stock',
      sortBy: 'name',
      sortOrder: 'asc',
    } as ListProductsQueryDto;

    await controller.findAll(query, ADMIN);

    expect(findAll).toHaveBeenCalledWith(query, 'ADMIN');
  });

  it('creates a product via the service', async () => {
    create.mockResolvedValue(sampleProduct);
    const dto = { sku: 'OFF-PEN-002', name: 'Ballpoint Pen', price: 1.99 };

    const result = await controller.create(dto as never, ADMIN);

    expect(result).toEqual(sampleProduct);
    expect(create).toHaveBeenCalledWith(dto, 'admin-id');
  });

  it('patches a product via the service', async () => {
    update.mockResolvedValue(sampleProduct);

    const result = await controller.update(
      'some-id',
      { name: 'X' } as never,
      ADMIN,
    );

    expect(result).toEqual(sampleProduct);
    expect(update).toHaveBeenCalledWith('some-id', { name: 'X' }, 'admin-id');
  });

  it('soft-deletes with a 204 status', async () => {
    remove.mockResolvedValue(undefined);

    await expect(controller.remove('some-id', ADMIN)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith('some-id', 'admin-id');

    // The DELETE handler is declared with @HttpCode(204).
    const noContent = Reflect.getMetadata(
      '__httpCode__',
      ProductsController.prototype.remove,
    );
    expect(noContent).toBe(HttpStatus.NO_CONTENT);
  });

  it('propagates the service 404 for unknown ids', async () => {
    findOne.mockRejectedValue(
      new NotFoundException(`Product some-id not found`),
    );

    await expect(controller.findOne('some-id', ADMIN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('uses the documented default status codes', () => {
    const codeOf = (handler: (...args: never[]) => unknown) =>
      Reflect.getMetadata('__httpCode__', handler) ?? HttpStatus.OK;

    // Nest's defaults: GET/PATCH → 200, POST → 201; DELETE explicitly 204.
    expect(codeOf(ProductsController.prototype.findOne)).toBe(HttpStatus.OK);
    expect(codeOf(ProductsController.prototype.update)).toBe(HttpStatus.OK);
    expect(
      Reflect.getMetadata('__httpCode__', ProductsController.prototype.remove),
    ).toBe(HttpStatus.NO_CONTENT);
  });

  it('requires products.write on POST, PATCH and DELETE (products.read on GET)', () => {
    const permissionsFor = (handler: (...args: never[]) => unknown) =>
      reflector.get<string[]>(PERMISSIONS_KEY, handler) ?? [];

    expect(permissionsFor(ProductsController.prototype.create)).toEqual([
      'products.write',
    ]);
    expect(permissionsFor(ProductsController.prototype.update)).toEqual([
      'products.write',
    ]);
    expect(permissionsFor(ProductsController.prototype.remove)).toEqual([
      'products.write',
    ]);
    expect(permissionsFor(ProductsController.prototype.findAll)).toEqual([
      'products.read',
    ]);
    expect(permissionsFor(ProductsController.prototype.findOne)).toEqual([
      'products.read',
    ]);
  });

  describe('product image endpoints', () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const file = { buffer: Buffer.from('image'), size: 5 } as never;

    it('uploads/replaces an image for ADMIN and returns the product', async () => {
      uploadImage.mockResolvedValue(sampleProduct);

      await expect(controller.uploadImage(id, file, ADMIN)).resolves.toEqual(
        sampleProduct,
      );
      expect(uploadImage).toHaveBeenCalledWith(id, file, 'admin-id');
    });

    it('returns 200 for the upload and 204 for the image delete', () => {
      expect(
        Reflect.getMetadata(
          '__httpCode__',
          ProductsController.prototype.uploadImage,
        ),
      ).toBe(HttpStatus.OK);
      expect(
        Reflect.getMetadata(
          '__httpCode__',
          ProductsController.prototype.removeImage,
        ),
      ).toBe(HttpStatus.NO_CONTENT);
    });

    it('requires products.write for both image endpoints', () => {
      const permissionsFor = (handler: (...args: never[]) => unknown) =>
        reflector.get<string[]>(PERMISSIONS_KEY, handler) ?? [];

      expect(
        permissionsFor(ProductsController.prototype.uploadImage),
      ).toEqual(['products.write']);
      expect(
        permissionsFor(ProductsController.prototype.removeImage),
      ).toEqual(['products.write']);
    });

    it('propagates 404 for a missing product', async () => {
      uploadImage.mockRejectedValue(
        new NotFoundException(`Product ${id} not found`),
      );

      await expect(
        controller.uploadImage(id, file, ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates 400 for a missing or invalid file', async () => {
      uploadImage.mockRejectedValue(
        new BadRequestException('An image file is required'),
      );

      await expect(
        controller.uploadImage(id, undefined, ADMIN),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(uploadImage).toHaveBeenCalledWith(id, undefined, 'admin-id');
    });

    it('deletes an image via the service', async () => {
      removeImage.mockResolvedValue(undefined);

      await expect(controller.removeImage(id, ADMIN)).resolves.toBeUndefined();
      expect(removeImage).toHaveBeenCalledWith(id, 'admin-id');
    });
  });

  describe('input validation (400) — body DTOs', () => {
    // The global ValidationPipe whitelist/forbidNonWhitelisted config in main.ts.
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const validate = (value: unknown, metatype: new () => unknown) =>
      pipe.transform(value, { type: 'body', metatype });

    it('rejects a body without sku, name or price', async () => {
      await expect(
        validate(
          { categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
          CreateProductDto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects negative price and quantity', async () => {
      await expect(
        validate(
          {
            sku: 'X-1',
            name: 'Test',
            price: -1,
            categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          },
          CreateProductDto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a non-UUID categoryId', async () => {
      await expect(
        validate(
          { sku: 'X-1', name: 'Test', price: 1, categoryId: 'not-a-uuid' },
          CreateProductDto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a sku longer than the VarChar(64) column', async () => {
      await expect(
        validate(
          {
            sku: 'a'.repeat(65),
            name: 'Test',
            price: 1,
            categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          },
          CreateProductDto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unknown (non-whitelisted) fields, e.g. direct quantity writes on PATCH', async () => {
      await expect(
        validate({ quantity: 5 }, UpdateProductDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a complete valid create body', async () => {
      await expect(
        validate(
          {
            sku: 'OFF-PEN-002',
            name: 'Ballpoint Pen',
            price: 1.99,
            costPrice: 0.6,
            quantity: 500,
            minStock: 50,
            categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            supplierId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          },
          CreateProductDto,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('input validation (400) — list query params', () => {
    // Mirrors the global ValidationPipe settings, including ?page=1&isActive=false.
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const validate = (value: unknown) =>
      pipe.transform(value, { type: 'query', metatype: ListProductsQueryDto });

    it.each([
      ['page below 1', { page: 0 }],
      ['non-numeric page', { page: 'first' }],
      ['limit above 100', { limit: 101 }],
      ['non-integer limit', { limit: 2.5 }],
      ['invalid sortBy', { sortBy: 'barcode' }],
      ['invalid sortOrder', { sortOrder: 'up' }],
      ['invalid stockStatus', { stockStatus: 'critical' }],
      ['non-UUID categoryId', { categoryId: 'not-a-uuid' }],
      ['non-UUID supplierId', { supplierId: 'not-a-uuid' }],
      ['non-boolean isActive', { isActive: 'maybe' }],
      ['over-long search', { search: 'x'.repeat(101) }],
      ['unknown non-whitelisted param', { q: 'pen' }],
    ])('rejects %s with 400', async (_name, bad) => {
      await expect(validate(bad)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid combined query and applies defaults', async () => {
      const transformed = await validate({
        search: 'pen',
        categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        supplierId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        isActive: 'false',
        stockStatus: 'low_stock',
        sortBy: 'price',
        sortOrder: 'asc',
      });

      expect(transformed).toMatchObject({
        search: 'pen',
        categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        supplierId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        isActive: false,
        stockStatus: 'low_stock',
        sortBy: 'price',
        sortOrder: 'asc',
        page: 1,
        limit: 20,
      });
    });
  });
});
