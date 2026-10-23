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
  SuppliersService,
  type SupplierDetailResponse,
  type SupplierListResponse,
  type SupplierResponse,
} from './suppliers.service.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { ListSuppliersQueryDto } from './dto/list-suppliers.query.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({
    summary: 'List suppliers (search, isActive filter, pagination)',
    description:
      'Returns the contract §1 pagination envelope, alphabetical by company name. Active suppliers only unless `isActive` is set (AD-001).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated supplier list',
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
    @Query() query: ListSuppliersQueryDto,
  ): Promise<SupplierListResponse> {
    return this.suppliersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a supplier by id',
    description:
      'Resolves soft-deleted suppliers too, with `isActive: false` (AD-001). `productCount` counts all linked products.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Supplier found (includes productCount)',
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
    description: 'Supplier does not exist',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupplierDetailResponse> {
    return this.suppliersService.findOne(id);
  }

  @Roles('ADMIN')
  @Post()
  @ApiOperation({ summary: 'Create a supplier (ADMIN only)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Supplier created' })
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
    description: 'STAFF cannot create suppliers',
  })
  create(@Body() dto: CreateSupplierDto): Promise<SupplierResponse> {
    return this.suppliersService.create(dto);
  }

  @Roles('ADMIN')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a supplier (ADMIN only)',
    description:
      'Partial update — companyName, contact fields (nullable), isActive.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Supplier updated' })
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
    description: 'STAFF cannot update suppliers',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Supplier does not exist',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<SupplierResponse> {
    return this.suppliersService.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a supplier (ADMIN only)',
    description:
      'Soft delete (AD-001): the row is deactivated, never removed — linked products and purchase orders keep their references.',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Supplier deactivated',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'STAFF cannot delete suppliers',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Supplier does not exist',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.suppliersService.remove(id);
  }
}
