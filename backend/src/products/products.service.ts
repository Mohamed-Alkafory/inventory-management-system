import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ProductResponse {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ProductResponse[]> {
    const products = await this.prisma.product.findMany({
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
    return products.map((p) => ({ ...p, price: Number(p.price) }));
  }
}
