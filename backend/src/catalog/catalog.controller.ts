import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CatalogService } from './catalog.service.js';
import {
  CatalogCategoryListResponseDto,
  CatalogProductListResponseDto,
  CatalogProductResponseDto,
} from './dto/catalog.responses.js';
import { ListCatalogCategoriesQueryDto } from './dto/list-catalog-categories.query.dto.js';
import { ListCatalogProductsQueryDto } from './dto/list-catalog-products.query.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';

/**
 * Public storefront rate limit. The global private API allows 100 requests per
 * minute; anonymous catalog browsing is capped lower to protect the database
 * from unauthenticated scraping.
 */
export const CATALOG_THROTTLE_LIMIT = 30;
export const CATALOG_THROTTLE_TTL_MS = 60_000;

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Throttle({
    default: {
      limit: CATALOG_THROTTLE_LIMIT,
      ttl: CATALOG_THROTTLE_TTL_MS,
    },
  })
  @Get('products')
  @ApiOperation({
    summary: 'Browse active products (public)',
    description:
      'No authentication required. Returns only active products in active categories, with an explicit customer-safe shape. `search` matches the product name; `sort` is `name`, `price` or `newest` (createdAt), with a deterministic `id` tie-break. `limit` is capped at 50. Throttled to 30 requests per minute.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated public product list',
    type: CatalogProductListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameter (including limit > 50)',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'More than 30 catalog requests per minute',
  })
  findProducts(
    @Query() query: ListCatalogProductsQueryDto,
  ): Promise<CatalogProductListResponseDto> {
    return this.catalogService.findProducts(query);
  }

  @Public()
  @Throttle({
    default: {
      limit: CATALOG_THROTTLE_LIMIT,
      ttl: CATALOG_THROTTLE_TTL_MS,
    },
  })
  @Get('products/:id')
  @ApiOperation({
    summary: 'Get an active product by id (public)',
    description:
      'No authentication required. Unknown, inactive or inactive-category products all answer 404 so hidden products cannot be probed. Internal fields are never returned. Throttled to 30 requests per minute.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Public product detail',
    type: CatalogProductResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'id is not a UUID',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'Product does not exist, is inactive or its category is inactive',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'More than 30 catalog requests per minute',
  })
  findProduct(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CatalogProductResponseDto> {
    return this.catalogService.findProduct(id);
  }

  @Public()
  @Throttle({
    default: {
      limit: CATALOG_THROTTLE_LIMIT,
      ttl: CATALOG_THROTTLE_TTL_MS,
    },
  })
  @Get('categories')
  @ApiOperation({
    summary: 'Browse active categories (public)',
    description:
      'No authentication required. Returns active categories only, alphabetical with an `id` tie-break. `limit` is capped at 50. Throttled to 30 requests per minute.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated public category list',
    type: CatalogCategoryListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameter (including limit > 50)',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'More than 30 catalog requests per minute',
  })
  findCategories(
    @Query() query: ListCatalogCategoriesQueryDto,
  ): Promise<CatalogCategoryListResponseDto> {
    return this.catalogService.findCategories(query);
  }
}
