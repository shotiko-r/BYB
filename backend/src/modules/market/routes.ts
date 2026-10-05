import type { FastifyInstance } from 'fastify';
import { MarketService } from './service.js';
import { PostgresMarketRepository } from './repository.js';

const repository = new PostgresMarketRepository();
const service = new MarketService(repository);

// eslint-disable-next-line @typescript-eslint/require-await
export async function marketRoutes(app: FastifyInstance) {
  app.get('/markets', async () => {
    return service.getActiveMarkets();
  });

  app.get('/markets/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    try {
      return await service.getMarketByCode(code);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({ code: 'NOT_FOUND', message: error.message });
      }
      throw error;
    }
  });
}