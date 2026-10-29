import { CatalogPaginationQueryDto } from './catalog-pagination.query.dto.js';

/**
 * GET /catalog/categories — active categories only. No filters are exposed:
 * the public picker needs the complete active list.
 */
export class ListCatalogCategoriesQueryDto extends CatalogPaginationQueryDto {}
