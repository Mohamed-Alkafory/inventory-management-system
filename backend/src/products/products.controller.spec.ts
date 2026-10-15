import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

describe('ProductsController', () => {
  let controller: ProductsController;
  const findAll = vi.fn();

  beforeEach(async () => {
    findAll.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: { findAll } }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('returns the products provided by the service', async () => {
    const products = [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        sku: 'OFF-PEN-002',
        name: 'Ballpoint Pen',
        description: null,
        price: 1.99,
        quantity: 500,
      },
    ];
    findAll.mockResolvedValue(products);

    await expect(controller.findAll()).resolves.toEqual(products);
    expect(findAll).toHaveBeenCalledTimes(1);
  });
});
