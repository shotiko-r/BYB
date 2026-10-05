import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SearchService } from './service.js';
import { MarketService } from '../market/service.js';
import { PostgresMarketRepository } from '../market/repository.js';
import { SearchQuerySchema } from '@byb/shared/types';

const marketRepository = new PostgresMarketRepository();
const marketService = new MarketService(marketRepository);
const searchService = new SearchService();

const SearchRequestSchema = SearchQuerySchema.extend({
  market: z.string().length(2).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await
export async function searchRoutes(app: FastifyInstance) {
  app.get('/search', async (request, reply) => {
    const parsed = SearchRequestSchema.safeParse(request.query);
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

    const result = await searchService.search(q, marketCode, {
      category,
      brand,
      minPrice,
      maxPrice,
      page,
      limit,
      sort,
    });

    return result;
  });

  app.get('/search/suggestions', async (request, _reply) => {
    const { q, market } = request.query as { q?: string; market?: string };
    if (!q || q.length < 2) {
      return { suggestions: [] };
    }

    const marketCode = market || 'GE';
    try {
      await marketService.validateMarket(marketCode);
    } catch {
      return { suggestions: [] };
    }

    const suggestions = [
      `${q} headphones`,
      `${q} wireless`,
      `${q} noise cancelling`,
      `${q} bluetooth`,
      `${q} gaming`,
      `${q} budget`,
      `${q} premium`,
    ].slice(0, 5);

    return { suggestions };
  });
}