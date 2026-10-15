import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProductsService } from './products.service.js';

describe('ProductsService', () => {
  let service: ProductsService;
  const findMany = vi.fn();

  beforeEach(async () => {
    findMany.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: { product: { findMany } } },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('returns active products with numeric prices and no internal fields', async () => {
    findMany.mockResolvedValue([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        sku: 'OFF-PEN-002',
        name: 'Ballpoint Pen',
        description: null,
        price: new Prisma.Decimal('1.99'),
        quantity: 500,
      },
    ]);

    await expect(service.findAll()).resolves.toEqual([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        sku: 'OFF-PEN-002',
        name: 'Ballpoint Pen',
        description: null,
        price: 1.99,
        quantity: 500,
      },
    ]);
  });

  it('queries only active products ordered by name', async () => {
    findMany.mockResolvedValue([]);

    await service.findAll();

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        price: true,
        quantity: true,
      },
    });
  });
});
