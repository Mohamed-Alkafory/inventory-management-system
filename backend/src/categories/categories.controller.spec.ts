import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { CategoriesController } from './categories.controller.js';
import {
  CategoriesService,
  type CategoryDetailResponse,
  type CategoryListResponse,
  type CategoryResponse,
} from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ListCategoriesQueryDto } from './dto/list-categories.query.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator.js';

const STAFF_USER = { sub: 'staff-id', role: 'STAFF' } as const;
const ADMIN_USER = { sub: 'admin-id', role: 'ADMIN' } as const;

const CATEGORY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const sampleCategory: CategoryResponse = {
  id: CATEGORY_ID,
  name: 'Electronics',
  description: 'Devices and accessories',
  isActive: true,
  createdAt: new Date('2026-10-15T00:00:00Z'),
  updatedAt: new Date('2026-10-15T00:00:00Z'),
};

const sampleDetail: CategoryDetailResponse = {
  ...sampleCategory,
  productCount: 7,
};

const samplePage: CategoryListResponse = {
  data: [sampleCategory],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const emptyPage: CategoryListResponse = {
  data: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

describe('CategoriesController', () => {
  let controller: CategoriesController;
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
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: { findAll, findOne, create, update, remove },
        },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    reflector = module.get(Reflector);
  });

  it('lists categories through the service (STAFF reads included)', async () => {
    findAll.mockResolvedValue(samplePage);
    const query = { page: 2, limit: 10 } as ListCategoriesQueryDto;

    await expect(controller.findAll(query)).resolves.toEqual(samplePage);
  });

  it('returns an empty envelope when nothing matches', async () => {
    findAll.mockResolvedValue(emptyPage);
    const query = { search: 'zzz-none' } as ListCategoriesQueryDto;

    await expect(controller.findAll(query)).resolves.toEqual(emptyPage);
  });

  it('forwards the list query to the service', async () => {
    findAll.mockResolvedValue(emptyPage);
    const query = { search: 'tec', isActive: false } as ListCategoriesQueryDto;

    await controller.findAll(query);

    expect(findAll).toHaveBeenCalledWith(query);
  });

  it('returns a category by id with its product count', async () => {
    findOne.mockResolvedValue(sampleDetail);

    await expect(controller.findOne(CATEGORY_ID)).resolves.toEqual(
      sampleDetail,
    );
    expect(findOne).toHaveBeenCalledWith(CATEGORY_ID);
  });

  it('creates a category via the service (201 default)', async () => {
    create.mockResolvedValue(sampleCategory);
    const dto = { name: 'Electronics' };

    const result = await controller.create(dto as never);

    expect(result).toEqual(sampleCategory);
    expect(create).toHaveBeenCalledWith(dto);
  });

  it('patches a category via the service', async () => {
    update.mockResolvedValue(sampleCategory);

    const result = await controller.update(CATEGORY_ID, {
      name: 'Computing',
    } as never);

    expect(result).toEqual(sampleCategory);
    expect(update).toHaveBeenCalledWith(CATEGORY_ID, { name: 'Computing' });
  });

  it('deletes with a 204 status', async () => {
    remove.mockResolvedValue(undefined);

    await expect(controller.remove(CATEGORY_ID)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(CATEGORY_ID);

    // The DELETE handler is declared with @HttpCode(204).
    const noContent = Reflect.getMetadata(
      '__httpCode__',
      CategoriesController.prototype.remove,
    );
    expect(noContent).toBe(HttpStatus.NO_CONTENT);
  });

  it('uses the documented default status codes', () => {
    const codeOf = (handler: (...args: never[]) => unknown) =>
      Reflect.getMetadata('__httpCode__', handler) ?? HttpStatus.OK;

    // Nest's defaults: GET/PATCH → 200, POST → 201; DELETE explicitly 204.
    expect(codeOf(CategoriesController.prototype.findOne)).toBe(HttpStatus.OK);
    expect(codeOf(CategoriesController.prototype.update)).toBe(HttpStatus.OK);
    // POST keeps Nest's 201 default — no explicit @HttpCode metadata.
    expect(
      Reflect.getMetadata(
        '__httpCode__',
        CategoriesController.prototype.create,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        '__httpCode__',
        CategoriesController.prototype.remove,
      ),
    ).toBe(HttpStatus.NO_CONTENT);
  });

  it('propagates the service 404 for unknown ids', async () => {
    findOne.mockRejectedValue(
      new NotFoundException(`Category ${CATEGORY_ID} not found`),
    );

    await expect(controller.findOne(CATEGORY_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('propagates the service 409 for a duplicate name or linked products', async () => {
    create.mockRejectedValue(
      new ConflictException(`Category with name Electronics already exists`),
    );
    remove.mockRejectedValue(
      new ConflictException(
        `Category ${CATEGORY_ID} still has 7 linked product(s)`,
      ),
    );

    await expect(create({ name: 'Electronics' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(remove(CATEGORY_ID)).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires categories.write on POST, PATCH and DELETE (categories.read on GET)', () => {
    const permissionsFor = (handler: (...args: never[]) => unknown) =>
      reflector.get<string[]>(PERMISSIONS_KEY, handler) ?? [];

    expect(permissionsFor(CategoriesController.prototype.create)).toEqual([
      'categories.write',
    ]);
    expect(permissionsFor(CategoriesController.prototype.update)).toEqual([
      'categories.write',
    ]);
    expect(permissionsFor(CategoriesController.prototype.remove)).toEqual([
      'categories.write',
    ]);
    expect(permissionsFor(CategoriesController.prototype.findAll)).toEqual([
      'categories.read',
    ]);
    expect(permissionsFor(CategoriesController.prototype.findOne)).toEqual([
      'categories.read',
    ]);
  });

  describe('authorization — STAFF can read but cannot write', () => {
    // The global PermissionsGuard from app.module.ts runs against the real handlers.
    let guard: PermissionsGuard;
    const contextFor = (
      handler: (...args: never[]) => unknown,
    ): ExecutionContext =>
      ({
        getHandler: () => handler,
        getClass: () => CategoriesController,
        switchToHttp: () => ({ getRequest: () => ({ user: STAFF_USER }) }),
      }) as unknown as ExecutionContext;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [PermissionsGuard, Reflector],
      }).compile();
      guard = module.get<PermissionsGuard>(PermissionsGuard);
    });

    it('allows STAFF reads', () => {
      expect(
        guard.canActivate(contextFor(CategoriesController.prototype.findAll)),
      ).toBe(true);
      expect(
        guard.canActivate(contextFor(CategoriesController.prototype.findOne)),
      ).toBe(true);
    });

    it('blocks STAFF create with 403', () => {
      expect(() =>
        guard.canActivate(contextFor(CategoriesController.prototype.create)),
      ).toThrow(ForbiddenException);
    });

    it('blocks STAFF update with 403', () => {
      expect(() =>
        guard.canActivate(contextFor(CategoriesController.prototype.update)),
      ).toThrow(ForbiddenException);
    });

    it('blocks STAFF delete with 403', () => {
      expect(() =>
        guard.canActivate(contextFor(CategoriesController.prototype.remove)),
      ).toThrow(ForbiddenException);
    });

    it('still allows ADMIN on the write endpoints', () => {
      const asAdmin = (
        handler: (...args: never[]) => unknown,
      ): ExecutionContext =>
        ({
          getHandler: () => handler,
          getClass: () => CategoriesController,
          switchToHttp: () => ({ getRequest: () => ({ user: ADMIN_USER }) }),
        }) as unknown as ExecutionContext;

      expect(
        guard.canActivate(asAdmin(CategoriesController.prototype.create)),
      ).toBe(true);
      expect(
        guard.canActivate(asAdmin(CategoriesController.prototype.update)),
      ).toBe(true);
      expect(
        guard.canActivate(asAdmin(CategoriesController.prototype.remove)),
      ).toBe(true);
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

    it('rejects a body without a name', async () => {
      await expect(
        validate({ description: 'x' }, CreateCategoryDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an empty name', async () => {
      await expect(
        validate({ name: '' }, CreateCategoryDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a name longer than the VarChar(100) column', async () => {
      await expect(
        validate({ name: 'a'.repeat(101) }, CreateCategoryDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a non-string description and an over-long one', async () => {
      await expect(
        validate({ name: 'Electronics', description: 7 }, CreateCategoryDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate(
          { name: 'Electronics', description: 'a'.repeat(5001) },
          CreateCategoryDto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unknown (non-whitelisted) fields', async () => {
      await expect(
        validate({ name: 'Electronics', isActive: true }, CreateCategoryDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate({ name: 'Electronics', slug: 'elec' }, UpdateCategoryDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid create body', async () => {
      await expect(
        validate(
          { name: 'Electronics', description: 'Devices and accessories' },
          CreateCategoryDto,
        ),
      ).resolves.toMatchObject({ name: 'Electronics' });
    });

    it('accepts a partial update body, including a null description', async () => {
      await expect(
        validate({ description: null, isActive: false }, UpdateCategoryDto),
      ).resolves.toMatchObject({ description: null, isActive: false });
    });

    it('rejects a non-boolean isActive on update', async () => {
      await expect(
        validate({ isActive: 'false' }, UpdateCategoryDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('input validation (400) — list query params', () => {
    // Mirrors the global ValidationPipe settings, including ?isActive=true.
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const validate = (value: unknown) =>
      pipe.transform(value, {
        type: 'query',
        metatype: ListCategoriesQueryDto,
      });

    it.each([
      ['page below 1', { page: 0 }],
      ['non-numeric page', { page: 'first' }],
      ['limit above 100', { limit: 101 }],
      ['non-integer limit', { limit: 2.5 }],
      ['non-boolean isActive', { isActive: 'maybe' }],
      ['over-long search', { search: 'x'.repeat(101) }],
      ['unknown non-whitelisted param', { q: 'elec' }],
    ] as const)('rejects %s with 400', async (_name, bad) => {
      await expect(validate(bad)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid query and applies defaults', async () => {
      const transformed = await validate({
        search: 'elec',
        isActive: 'false',
      });

      expect(transformed).toMatchObject({
        search: 'elec',
        isActive: false,
        page: 1,
        limit: 20,
      });
    });
  });
});
