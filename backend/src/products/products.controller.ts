import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ProductsService, type ProductListResponse, type ProductResponse } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products.query.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

/** JWT role claim resolved from the database by the global JwtAuthGuard. */
interface AuthenticatedUser {
  sub: string;
  role: string;
}

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'List products (search, filters, sorting, pagination)',
    description:
      'Returns the contract §1 pagination envelope. Active products only unless `isActive` is set (AD-001). `costPrice` is included for ADMIN only (AD-004). `stockStatus=low_stock` compares `quantity <= minStock` (raw SQL, whitelisted ORDER BY).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated product list (prices as numbers, costPrice ADMIN-only).',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid query parameter' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing or invalid token' })
  findAll(
    @Query() query: ListProductsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductListResponse> {
    return this.productsService.findAll(query, user.role);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a product by id',
    description:
      'Resolves soft-deleted products too, with `isActive: false` (AD-001). `costPrice` ADMIN only.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing or invalid token' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product does not exist' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductResponse> {
    return this.productsService.findOne(id, user.role);
  }

  @Roles('ADMIN')
  @Post()
  @ApiOperation({ summary: 'Create a product (ADMIN only)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Product created' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing or invalid token' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'STAFF cannot create products' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'categoryId or supplierId does not exist',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Duplicate SKU or barcode',
  })
  create(@Body() dto: CreateProductDto): Promise<ProductResponse> {
    return this.productsService.create(dto);
  }

  @Roles('ADMIN')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a product (ADMIN only)',
    description:
      'Partial update. `quantity` is not editable here (stock service only, AD-005); deactivation is the DELETE soft delete (AD-001).',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product updated' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing or invalid token' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'STAFF cannot update products' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product/category/supplier not found' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Duplicate SKU or barcode',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    return this.productsService.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a product (ADMIN only, AD-001)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Product deactivated' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing or invalid token' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'STAFF cannot delete products' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product does not exist' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.productsService.remove(id);
  }
}
