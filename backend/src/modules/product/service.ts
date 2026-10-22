import type { ProductRepository, ProductSearchFilters } from './repository.js';
import type { ProductWithOffers } from '@byb/shared/types';
import { AppError } from '../../shared/errors.js';
import { providerRegistry } from '../provider/registry.js';
import { EbayProductDetailEnricher, type ProductDetailEnricher } from './detail-enrichment.js';

export class ProductService {
  constructor(
    private readonly repository: ProductRepository,
    private readonly detailEnricher: ProductDetailEnricher = new EbayProductDetailEnricher(providerRegistry),
  ) {}

  async getProductById(id: string, marketId: string, marketCode: string): Promise<ProductWithOffers> {
    const product = await this.repository.findByIdWithOffers(id, marketId);
    if (!product) {
      throw AppError.notFound(`Product with id ${id} not found`);
    }
    return this.detailEnricher.enrich(product, marketCode);
  }

  async searchProducts(filters: ProductSearchFilters): Promise<{
    products: ProductWithOffers[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { products, total } = await this.repository.search(filters);
    return {
      products,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  }
}