import type { ProductRepository, ProductSearchFilters } from './repository.js';
import type { ProductWithOffers } from '@byb/shared/types';
import { AppError } from '../../shared/errors.js';

export class ProductService {
  constructor(private readonly repository: ProductRepository) {}

  async getProductById(id: string, marketId: string): Promise<ProductWithOffers> {
    const product = await this.repository.findByIdWithOffers(id, marketId);
    if (!product) {
      throw AppError.notFound(`Product with id ${id} not found`);
    }
    return product;
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