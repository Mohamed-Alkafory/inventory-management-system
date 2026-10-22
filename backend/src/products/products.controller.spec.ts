import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ProductsController } from './products.controller.js';
import { ProductsService, type ProductResponse } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';

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

describe('ProductsController', () => {
  let controller: ProductsController;
  let reflector: Reflector;
  const findAll = vi.fn();
  const findOne = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const remove = vi.fn();

  beforeEach(async () => {
    findAll.mockReset();
    findOne.mockReset();
    create.mockReset();
    update.mockReset();
    remove.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: { findAll, findOne, create, update, remove },
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    reflector = module.get(Reflector);
  });

  it('returns the products provided by the service (existing behavior)', async () => {
    findAll.mockResolvedValue([sampleProduct]);

    await expect(controller.findAll(ADMIN)).resolves.toEqual([sampleProduct]);
    expect(findAll).toHaveBeenCalledWith('ADMIN');
  });

  it('passes the requester role for costPrice filtering', async () => {
    findAll.mockResolvedValue([]);
    findOne.mockResolvedValue(sampleProduct);

    await controller.findAll(STAFF);
    await controller.findOne('some-id', STAFF);

    expect(findAll).toHaveBeenCalledWith('STAFF');
    expect(findOne).toHaveBeenCalledWith('some-id', 'STAFF');
  });

  it('creates a product via the service', async () => {
    create.mockResolvedValue(sampleProduct);
    const dto = { sku: 'OFF-PEN-002', name: 'Ballpoint Pen', price: 1.99 };

    const result = await controller.create(dto as never);

    expect(result).toEqual(sampleProduct);
    expect(create).toHaveBeenCalledWith(dto);
  });

  it('patches a product via the service', async () => {
    update.mockResolvedValue(sampleProduct);

    const result = await controller.update('some-id', { name: 'X' } as never);

    expect(result).toEqual(sampleProduct);
    expect(update).toHaveBeenCalledWith('some-id', { name: 'X' });
  });

  it('soft-deletes with a 204 status', async () => {
    remove.mockResolvedValue(undefined);

    await expect(controller.remove('some-id')).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith('some-id');

    // The DELETE handler is declared with @HttpCode(204).
    const noContent = Reflect.getMetadata(
      '__httpCode__',
      ProductsController.prototype.remove,
    );
    expect(noContent).toBe(HttpStatus.NO_CONTENT);
  });

  it('propagates the service 404 for unknown ids', async () => {
    findOne.mockRejectedValue(new NotFoundException(`Product some-id not found`));

    await expect(controller.findOne('some-id', ADMIN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('uses the documented default status codes', () => {
    const codeOf = (handler: (...args: never[]) => unknown) =>
      Reflect.getMetadata('__httpCode__', handler) ?? HttpStatus.OK;

    // Nest's defaults: GET/PATCH → 200, POST → 201 (no metadata set means 201
    // via RequestMapping default), DELETE explicitly decorated with 204.
    expect(codeOf(ProductsController.prototype.findOne)).toBe(HttpStatus.OK);
    expect(codeOf(ProductsController.prototype.update)).toBe(HttpStatus.OK);
    expect(Reflect.getMetadata('__httpCode__', ProductsController.prototype.remove)).toBe(
      HttpStatus.NO_CONTENT,
    );
  });

  it('requires ADMIN on POST, PATCH and DELETE (and allows any role on GET)', () => {
    const rolesFor = (handler: (...args: never[]) => unknown) =>
      reflector.get<string[]>(ROLES_KEY, handler) ?? [];

    expect(rolesFor(ProductsController.prototype.create)).toEqual(['ADMIN']);
    expect(rolesFor(ProductsController.prototype.update)).toEqual(['ADMIN']);
    expect(rolesFor(ProductsController.prototype.remove)).toEqual(['ADMIN']);
    expect(rolesFor(ProductsController.prototype.findAll)).toEqual([]);
    expect(rolesFor(ProductsController.prototype.findOne)).toEqual([]);
  });

  describe('input validation (400)', () => {
    // The global ValidationPipe whitelist/forbidNonWhitelisted config in main.ts.
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
    const validate = (value: unknown, metatype: new () => unknown) =>
      pipe.transform(value, { type: 'body', metatype });

    it('rejects a body without sku, name or price', async () => {
      await expect(
        validate({ categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }, CreateProductDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects negative price and quantity', async () => {
      await expect(
        validate(
          { sku: 'X-1', name: 'Test', price: -1, categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
          CreateProductDto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a non-UUID categoryId', async () => {
      await expect(
        validate({ sku: 'X-1', name: 'Test', price: 1, categoryId: 'not-a-uuid' }, CreateProductDto),
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

});
