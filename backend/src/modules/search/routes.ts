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

    const { q, market, category, minPrice, maxPrice, brand, currencyCode, currency, merchant, page, limit, sort } = parsed.data;

    const marketCode = (market || 'GE').toUpperCase();
    try {
      await marketService.validateMarket(marketCode);
    } catch {
      return reply.code(400).send({ code: 'VALIDATION_ERROR', message: 'Unknown market' });
    }

    const result = await searchService.search(q, marketCode, {
      category,
      brand,
      currencyCode,
      currency,
      merchant,
      minPrice,
      maxPrice,
      page,
      limit,
      sort,
    });

    return result;
  });

  app.get('/search/options', async (request, reply) => {
    const parsed = z.object({ market: z.string().regex(/^[A-Za-z]{2}$/).default('GE') }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ code: 'VALIDATION_ERROR', message: 'Invalid market' });
    return searchService.options(parsed.data.market.toUpperCase());
  });

  app.get('/search/suggestions', async (request, reply) => {
    const parsed = z.object({ q: z.string().trim().max(100).default(''), market: z.string().regex(/^[A-Za-z]{2}$/).default('GE') }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ code: 'VALIDATION_ERROR', message: 'Invalid suggestion parameters' });
    if (parsed.data.q.length < 2) return { suggestions: [] };
    return { suggestions: await searchService.suggestions(parsed.data.q, parsed.data.market.toUpperCase()) };
  });
}
