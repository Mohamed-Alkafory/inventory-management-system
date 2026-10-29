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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  CategoriesService,
  type CategoryDetailResponse,
  type CategoryListResponse,
  type CategoryResponse,
} from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ListCategoriesQueryDto } from './dto/list-categories.query.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermission('categories.read')
  @ApiOperation({
    summary: 'List categories (search, isActive filter, pagination)',
    description:
      'Returns the contract §1 pagination envelope, alphabetical by name. Active categories only unless `isActive` is set (AD-001).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated category list',
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
    @Query() query: ListCategoriesQueryDto,
  ): Promise<CategoryListResponse> {
    return this.categoriesService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('categories.read')
  @ApiOperation({
    summary: 'Get a category by id',
    description:
      'Resolves soft-deleted categories too, with `isActive: false` (AD-001). `productCount` counts all linked products.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category found (includes productCount)',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'id is not a UUID',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category does not exist',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryDetailResponse> {
    return this.categoriesService.findOne(id);
  }

  @RequirePermission('categories.write')
  @Post()
  @ApiOperation({ summary: 'Create a category (ADMIN only)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Category created' })
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
    description: 'STAFF cannot create categories',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A category with the same name already exists',
  })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryResponse> {
    return this.categoriesService.create(dto);
  }

  @RequirePermission('categories.write')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a category (ADMIN only)',
    description:
      'Partial update — name, description, isActive. Renaming to a taken name answers 409.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Category updated' })
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
    description: 'STAFF cannot update categories',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category does not exist',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A category with the new name already exists',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    return this.categoriesService.update(id, dto);
  }

  @RequirePermission('categories.write')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a category (ADMIN only)',
    description:
      'Soft delete (AD-001). Rejected with 409 while products are still linked, so a product relation is never broken.',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Category deactivated',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'STAFF cannot delete categories',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category does not exist',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Category still has linked products',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
