import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SuppliersController } from './suppliers.controller.js';
import {
  SuppliersService,
  type SupplierDetailResponse,
  type SupplierListResponse,
  type SupplierResponse,
} from './suppliers.service.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { ListSuppliersQueryDto } from './dto/list-suppliers.query.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';

const STAFF_USER = { sub: 'staff-id', role: 'STAFF' } as const;
const ADMIN_USER = { sub: 'admin-id', role: 'ADMIN' } as const;

const SUPPLIER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const sampleSupplier: SupplierResponse = {
  id: SUPPLIER_ID,
  companyName: 'Office Plus Ltd.',
  email: 'sales@officeplus.com',
  phone: '+201005551234',
  address: '12 Nasr Street, Cairo',
  isActive: true,
  createdAt: new Date('2026-10-15T00:00:00Z'),
  updatedAt: new Date('2026-10-15T00:00:00Z'),
};

const sampleDetail: SupplierDetailResponse = {
  ...sampleSupplier,
  productCount: 9,
};

const samplePage: SupplierListResponse = {
  data: [sampleSupplier],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const emptyPage: SupplierListResponse = {
  data: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

describe('SuppliersController', () => {
  let controller: SuppliersController;
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
      controllers: [SuppliersController],
      providers: [
        {
          provide: SuppliersService,
          useValue: { findAll, findOne, create, update, remove },
        },
      ],
    }).compile();

    controller = module.get<SuppliersController>(SuppliersController);
    reflector = module.get(Reflector);
  });

  it('lists suppliers through the service (STAFF reads included)', async () => {
    findAll.mockResolvedValue(samplePage);
    const query = { page: 2, limit: 10 } as ListSuppliersQueryDto;

    await expect(controller.findAll(query)).resolves.toEqual(samplePage);
  });

  it('returns an empty envelope when nothing matches', async () => {
    findAll.mockResolvedValue(emptyPage);
    const query = { search: 'zzz-none' } as ListSuppliersQueryDto;

    await expect(controller.findAll(query)).resolves.toEqual(emptyPage);
  });

  it('forwards the list query to the service', async () => {
    findAll.mockResolvedValue(emptyPage);
    const query = {
      search: 'office',
      isActive: false,
    } as ListSuppliersQueryDto;

    await controller.findAll(query);

    expect(findAll).toHaveBeenCalledWith(query);
  });

  it('returns a supplier by id with its product count', async () => {
    findOne.mockResolvedValue(sampleDetail);

    await expect(controller.findOne(SUPPLIER_ID)).resolves.toEqual(
      sampleDetail,
    );
    expect(findOne).toHaveBeenCalledWith(SUPPLIER_ID);
  });

  it('creates a supplier via the service (201 default)', async () => {
    create.mockResolvedValue(sampleSupplier);
    const dto = { companyName: 'Office Plus Ltd.' };

    const result = await controller.create(dto as never);

    expect(result).toEqual(sampleSupplier);
    expect(create).toHaveBeenCalledWith(dto);
  });

  it('patches a supplier via the service', async () => {
    update.mockResolvedValue(sampleSupplier);

    const result = await controller.update(SUPPLIER_ID, {
      phone: '+201111111111',
    } as never);

    expect(result).toEqual(sampleSupplier);
    expect(update).toHaveBeenCalledWith(SUPPLIER_ID, {
      phone: '+201111111111',
    });
  });

  it('deletes with a 204 status', async () => {
    remove.mockResolvedValue(undefined);

    await expect(controller.remove(SUPPLIER_ID)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(SUPPLIER_ID);

    // The DELETE handler is declared with @HttpCode(204).
    const noContent = Reflect.getMetadata(
      '__httpCode__',
      SuppliersController.prototype.remove,
    );
    expect(noContent).toBe(HttpStatus.NO_CONTENT);
  });

  it('uses the documented default status codes', () => {
    const codeOf = (handler: (...args: never[]) => unknown) =>
      Reflect.getMetadata('__httpCode__', handler) ?? HttpStatus.OK;

    // Nest's defaults: GET/PATCH → 200, POST → 201; DELETE explicitly 204.
    expect(codeOf(SuppliersController.prototype.findOne)).toBe(HttpStatus.OK);
    expect(codeOf(SuppliersController.prototype.update)).toBe(HttpStatus.OK);
    // POST keeps Nest's 201 default — no explicit @HttpCode metadata.
    expect(
      Reflect.getMetadata('__httpCode__', SuppliersController.prototype.create),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata('__httpCode__', SuppliersController.prototype.remove),
    ).toBe(HttpStatus.NO_CONTENT);
  });

  it('propagates the service 404 for unknown ids', async () => {
    findOne.mockRejectedValue(
      new NotFoundException(`Supplier ${SUPPLIER_ID} not found`),
    );

    await expect(controller.findOne(SUPPLIER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('requires ADMIN on POST, PATCH and DELETE (and allows any role on GET)', () => {
    const rolesFor = (handler: (...args: never[]) => unknown) =>
      reflector.get<string[]>(ROLES_KEY, handler) ?? [];

    expect(rolesFor(SuppliersController.prototype.create)).toEqual(['ADMIN']);
    expect(rolesFor(SuppliersController.prototype.update)).toEqual(['ADMIN']);
    expect(rolesFor(SuppliersController.prototype.remove)).toEqual(['ADMIN']);
    expect(rolesFor(SuppliersController.prototype.findAll)).toEqual([]);
    expect(rolesFor(SuppliersController.prototype.findOne)).toEqual([]);
  });

  describe('authorization — STAFF can read but cannot write', () => {
    // The global RolesGuard from app.module.ts runs against the real handlers.
    let guard: RolesGuard;
    const contextFor = (
      handler: (...args: never[]) => unknown,
    ): ExecutionContext =>
      ({
        getHandler: () => handler,
        getClass: () => SuppliersController,
        switchToHttp: () => ({ getRequest: () => ({ user: STAFF_USER }) }),
      }) as unknown as ExecutionContext;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [RolesGuard, Reflector],
      }).compile();
      guard = module.get<RolesGuard>(RolesGuard);
    });

    it('allows STAFF reads', () => {
      expect(
        guard.canActivate(contextFor(SuppliersController.prototype.findAll)),
      ).toBe(true);
      expect(
        guard.canActivate(contextFor(SuppliersController.prototype.findOne)),
      ).toBe(true);
    });

    it('blocks STAFF create with 403', () => {
      expect(() =>
        guard.canActivate(contextFor(SuppliersController.prototype.create)),
      ).toThrow(ForbiddenException);
    });

    it('blocks STAFF update with 403', () => {
      expect(() =>
        guard.canActivate(contextFor(SuppliersController.prototype.update)),
      ).toThrow(ForbiddenException);
    });

    it('blocks STAFF delete with 403', () => {
      expect(() =>
        guard.canActivate(contextFor(SuppliersController.prototype.remove)),
      ).toThrow(ForbiddenException);
    });

    it('still allows ADMIN on the write endpoints', () => {
      const asAdmin = (
        handler: (...args: never[]) => unknown,
      ): ExecutionContext =>
        ({
          getHandler: () => handler,
          getClass: () => SuppliersController,
          switchToHttp: () => ({ getRequest: () => ({ user: ADMIN_USER }) }),
        }) as unknown as ExecutionContext;

      expect(
        guard.canActivate(asAdmin(SuppliersController.prototype.create)),
      ).toBe(true);
      expect(
        guard.canActivate(asAdmin(SuppliersController.prototype.update)),
      ).toBe(true);
      expect(
        guard.canActivate(asAdmin(SuppliersController.prototype.remove)),
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

    it('rejects a body without a company name', async () => {
      await expect(
        validate({ email: 'x@y.com' }, CreateSupplierDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an empty company name', async () => {
      await expect(
        validate({ companyName: '' }, CreateSupplierDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a company name longer than the VarChar(200) column', async () => {
      await expect(
        validate({ companyName: 'a'.repeat(201) }, CreateSupplierDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a malformed email', async () => {
      await expect(
        validate(
          { companyName: 'Office Plus Ltd.', email: 'not-an-email' },
          CreateSupplierDto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a phone longer than the VarChar(20) column', async () => {
      await expect(
        validate(
          { companyName: 'Office Plus Ltd.', phone: '1'.repeat(21) },
          CreateSupplierDto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a non-string address', async () => {
      await expect(
        validate(
          { companyName: 'Office Plus Ltd.', address: 7 },
          CreateSupplierDto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unknown (non-whitelisted) fields', async () => {
      await expect(
        validate(
          { companyName: 'Office Plus Ltd.', companyCode: 'OP-1' },
          CreateSupplierDto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate(
          { companyName: 'Office Plus Ltd.', companyCode: 'OP-1' },
          UpdateSupplierDto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid create body', async () => {
      await expect(
        validate(
          {
            companyName: 'Office Plus Ltd.',
            email: 'sales@officeplus.com',
            phone: '+201005551234',
            address: '12 Nasr Street, Cairo',
          },
          CreateSupplierDto,
        ),
      ).resolves.toMatchObject({ companyName: 'Office Plus Ltd.' });
    });

    it('accepts a partial update body with cleared (null) contact fields', async () => {
      await expect(
        validate(
          { email: null, phone: null, address: null },
          UpdateSupplierDto,
        ),
      ).resolves.toMatchObject({ email: null, phone: null, address: null });
    });

    it('accepts an explicit isActive toggle on update', async () => {
      await expect(
        validate(
          { companyName: 'Office Plus Ltd.', isActive: true },
          UpdateSupplierDto,
        ),
      ).resolves.toMatchObject({
        companyName: 'Office Plus Ltd.',
        isActive: true,
      });
    });

    it('rejects a non-boolean isActive on update', async () => {
      await expect(
        validate({ isActive: 'false' }, UpdateSupplierDto),
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
      pipe.transform(value, { type: 'query', metatype: ListSuppliersQueryDto });

    it.each([
      ['page below 1', { page: 0 }],
      ['non-numeric page', { page: 'first' }],
      ['limit above 100', { limit: 101 }],
      ['non-integer limit', { limit: 2.5 }],
      ['non-boolean isActive', { isActive: 'maybe' }],
      ['over-long search', { search: 'x'.repeat(101) }],
      ['unknown non-whitelisted param', { q: 'office' }],
    ] as const)('rejects %s with 400', async (_name, bad) => {
      await expect(validate(bad)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid query and applies defaults', async () => {
      const transformed = await validate({
        search: 'office',
        isActive: 'false',
      });

      expect(transformed).toMatchObject({
        search: 'office',
        isActive: false,
        page: 1,
        limit: 20,
      });
    });
  });
});
