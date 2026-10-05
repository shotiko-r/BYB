import type { FastifyInstance } from 'fastify';
import { PostgresMerchantRepository } from './repository.js';

const repository = new PostgresMerchantRepository();

// eslint-disable-next-line @typescript-eslint/require-await
export async function merchantRoutes(app: FastifyInstance) {
  app.get('/merchants', async () => {
    return repository.findAll();
  });

  app.get('/merchants/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const merchant = await repository.findByCode(code);
    if (!merchant) {
      return reply.code(404).send({ code: 'NOT_FOUND', message: `Merchant ${code} not found` });
    }
    return merchant;
  });
}