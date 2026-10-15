import { Controller, Get } from '@nestjs/common';
import { ProductsService, type ProductResponse } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(): Promise<ProductResponse[]> {
    return this.productsService.findAll();
  }
}
