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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import {
  ProductsService,
  type ProductListResponse,
  type ProductResponse,
} from './products.service.js';
import {
  MAX_IMAGE_SIZE_BYTES,
  type UploadedImageFile,
} from '../storage/image-storage.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products.query.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';

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
  @RequirePermission('products.read')
  @ApiOperation({
    summary: 'List products (search, filters, sorting, pagination)',
    description:
      'Returns the contract §1 pagination envelope. Active products only unless `isActive` is set (AD-001). `costPrice` is included for ADMIN only (AD-004). `stockStatus=low_stock` compares `quantity <= minStock` (raw SQL, whitelisted ORDER BY).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Paginated product list (prices as numbers, costPrice ADMIN-only).',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameter',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  findAll(
    @Query() query: ListProductsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductListResponse> {
    return this.productsService.findAll(query, user.role);
  }

  @Get(':id')
  @RequirePermission('products.read')
  @ApiOperation({
    summary: 'Get a product by id',
    description:
      'Resolves soft-deleted products too, with `isActive: false` (AD-001). `costPrice` ADMIN only.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product found' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product does not exist',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductResponse> {
    return this.productsService.findOne(id, user.role);
  }

  @RequirePermission('products.write')
  @Post()
  @ApiOperation({ summary: 'Create a product (ADMIN only)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Product created' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'STAFF cannot create products',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'categoryId or supplierId does not exist',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Duplicate SKU or barcode',
  })
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductResponse> {
    return this.productsService.create(dto, user.sub);
  }

  @RequirePermission('products.write')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a product (ADMIN only)',
    description:
      'Partial update. `quantity` is not editable here (stock service only, AD-005); deactivation is the DELETE soft delete (AD-001).',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product updated' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'STAFF cannot update products',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product/category/supplier not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Duplicate SKU or barcode',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductResponse> {
    return this.productsService.update(id, dto, user.sub);
  }

  @RequirePermission('products.write')
  @Post(':id/image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    // Memory storage (multer's default) lets the service inspect magic bytes
    // before anything is written to disk.
    FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_SIZE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Product image file (max 2 MB; JPEG, PNG or WebP)',
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload or replace a product image (ADMIN only)',
    description:
      'Multipart field `image`; the stored `imageUrl` is a relative `/uploads/products/...` path. The previous local file is deleted.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product with the new imageUrl',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Missing file or unsupported image type',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'STAFF cannot manage product images',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product does not exist',
  })
  @ApiResponse({
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    description: 'Image is larger than 2 MB',
  })
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() image: UploadedImageFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductResponse> {
    return this.productsService.uploadImage(id, image, user.sub);
  }

  @RequirePermission('products.write')
  @Delete(':id/image')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a product image (ADMIN only)',
    description:
      'Clears `imageUrl` and removes the local file. External image URLs are never deleted from disk.',
  })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Image removed' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'STAFF cannot manage product images',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product does not exist',
  })
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.productsService.removeImage(id, user.sub);
  }

  @RequirePermission('products.write')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a product (ADMIN only, AD-001)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Product deactivated',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'STAFF cannot delete products',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product does not exist',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.productsService.remove(id, user.sub);
  }
}
