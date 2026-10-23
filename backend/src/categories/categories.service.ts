import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { ListCategoriesQueryDto } from './dto/list-categories.query.dto.js';

/** Contract §3.3 `Category` shape. */
export interface CategoryResponse {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** `GET /categories/:id` — the category plus the number of linked products. */
export interface CategoryDetailResponse extends CategoryResponse {
  productCount: number;
}

/** Contract §3.3 list response — §1 pagination envelope. */
export interface CategoryListResponse {
  data: CategoryResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const CATEGORY_SELECT = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

/** Detail read counts linked products in the same query (`_count`). */
const CATEGORY_DETAIL_SELECT = {
  ...CATEGORY_SELECT,
  _count: { select: { products: true } },
} satisfies Prisma.CategorySelect;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paginated, searchable category list (contract §3.3). Active categories
   * only by default (AD-001 — soft-deleted rows disappear from the listing;
   * they still resolve by id) — an explicit `isActive` query param overrides
   * that. Fixed alphabetical ordering keeps pickers stable; the secondary
   * `id` sort breaks ties deterministically.
   */
  async findAll(query: ListCategoriesQueryDto): Promise<CategoryListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.CategoryWhereInput = {
      isActive: query.isActive ?? true,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [total, categories] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: CATEGORY_SELECT,
      }),
    ]);

    return this.toPage(categories, total, page, limit);
  }

  /**
   * Detail by id, including how many products reference the category. Inactive
   * (soft-deleted) categories still resolve — the list hides them, AD-001
   * keeps them resolvable for history/reference — and `isActive` plus the
   * count let clients render the state.
   */
  async findOne(id: string): Promise<CategoryDetailResponse> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: CATEGORY_DETAIL_SELECT,
    });

    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    const { _count, ...rest } = category;
    return { ...rest, productCount: _count.products };
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponse> {
    // Duplicate name answers 409 (contract §3.3). The unique `name` index
    // plus the global Prisma filter (P2002 → 409) back this up if two writes
    // race between the pre-check and the insert.
    await this.assertNameAvailable(dto.name);

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
      select: CATEGORY_SELECT,
    });

    return category;
  }

  /**
   * Partial update. Renaming to a name taken by another category answers
   * 409; the DB unique index remains the backstop for concurrent writes.
   */
  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryResponse> {
    const where = { id };
    const existing = await this.prisma.category.findUnique({
      where,
      select: CATEGORY_SELECT,
    });

    if (!existing) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    if (dto.name !== undefined && dto.name !== existing.name) {
      await this.assertNameAvailable(dto.name);
    }

    const data: Prisma.CategoryUncheckedUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    return this.prisma.category.update({
      where,
      data,
      select: CATEGORY_SELECT,
    });
  }

  /**
   * A category still referenced by products cannot be removed without
   * breaking the `Product` relation (`products.category_id` FK is
   * ON DELETE RESTRICT) — such requests answer 409. Otherwise AD-001 soft
   * delete applies: set `isActive = false`, never remove the row.
   */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    const linkedProducts = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (linkedProducts > 0) {
      throw new ConflictException(
        `Category ${id} still has ${linkedProducts} linked product(s)`,
      );
    }

    await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
      select: { id: true },
    });
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({
      where: { name },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(`Category with name ${name} already exists`);
    }
  }

  private toPage(
    data: CategoryResponse[],
    total: number,
    page: number,
    limit: number,
  ): CategoryListResponse {
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
