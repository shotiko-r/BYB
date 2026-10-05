import type { FastifyInstance } from 'fastify';
import { ProductService } from './service.js';
import { PostgresProductRepository, type ProductSearchFilters } from './repository.js';
import { MarketService } from '../market/service.js';
import { PostgresMarketRepository } from '../market/repository.js';
import { SearchQuerySchema } from '@byb/shared/types';

const productRepository = new PostgresProductRepository();
const productService = new ProductService(productRepository);
const marketRepository = new PostgresMarketRepository();
const marketService = new MarketService(marketRepository);

// eslint-disable-next-line @typescript-eslint/require-await
export async function productRoutes(app: FastifyInstance) {
  app.get('/products/search', async (request, reply) => {
    const parsed = SearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid search parameters',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { q, market, category, minPrice, maxPrice, brand, page, limit, sort } = parsed.data;

    let marketCode = market || 'GE';
    try {
      await marketService.validateMarket(marketCode);
    } catch {
      marketCode = 'GE';
    }

    const marketEntity = await marketService.getMarketByCode(marketCode);

    const filters: ProductSearchFilters = {
      marketId: marketEntity.id,
      query: q,
      categoryId: category,
      brand,
      minPrice,
      maxPrice,
      page,
      limit,
      sort,
    };

    const result = await productService.searchProducts(filters);

    return {
      products: result.products,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      query: parsed.data,
    };
  });

  app.get('/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const marketCode = (request.query as { market?: string }).market || 'GE';

    try {
      const marketEntity = await marketService.validateMarket(marketCode);
      const product = await productService.getProductById(id, marketEntity.id);
      return product;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({ code: 'NOT_FOUND', message: error.message });
      }
      throw error;
    }
  });
}