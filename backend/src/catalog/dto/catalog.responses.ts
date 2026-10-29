import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Public category shape. Intentionally narrower than the authenticated
 * `Category`: no `isActive`, no timestamps and no internal counters.
 */
export class CatalogCategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Electronics' })
  name!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: 'Devices and accessories',
  })
  description!: string | null;
}

/** Nested category reference returned with every public product. */
export class CatalogProductCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Electronics' })
  name!: string;
}

/**
 * Public product shape. It is built field by field from an explicit Prisma
 * select; internal columns (costPrice, minStock, barcode, supplier, isActive,
 * exact quantity and timestamps) never reach this DTO.
 */
export class CatalogProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  /** Already shown to customers in their order snapshots and the storefront. */
  @ApiProperty({ example: 'OFF-PEN-002' })
  sku!: string;

  @ApiProperty({ example: 'Ballpoint Pen' })
  name!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: 'Blue ink, 0.7 mm',
  })
  description!: string | null;

  @ApiProperty({ example: 1.99, type: Number })
  price!: number;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: '/uploads/products/7f9c2a9e-3e73-4f3a-8a99-1c6f0f8f0f10.webp',
  })
  imageUrl!: string | null;

  @ApiProperty({ type: CatalogProductCategoryDto })
  category!: CatalogProductCategoryDto;

  @ApiProperty({ example: true })
  inStock!: boolean;

  @ApiProperty({
    example: 20,
    description:
      'Maximum quantity a customer may order, capped by the storefront limit.',
  })
  maxOrderable!: number;
}

export class CatalogPaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class CatalogProductListResponseDto {
  @ApiProperty({ type: [CatalogProductResponseDto] })
  data!: CatalogProductResponseDto[];

  @ApiProperty({ type: CatalogPaginationMetaDto })
  meta!: CatalogPaginationMetaDto;
}

export class CatalogCategoryListResponseDto {
  @ApiProperty({ type: [CatalogCategoryResponseDto] })
  data!: CatalogCategoryResponseDto[];

  @ApiProperty({ type: CatalogPaginationMetaDto })
  meta!: CatalogPaginationMetaDto;
}
