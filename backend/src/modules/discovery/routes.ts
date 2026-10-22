import type { FastifyInstance } from 'fastify';
import { DiscoveryHomeSchema, DiscoveryQuerySchema, DiscoverySectionKeySchema } from '@byb/shared/types';
import { isAppError } from '../../shared/errors.js';
import { DiscoveryService } from './service.js';

export async function discoveryRoutes(app: FastifyInstance, options: { service?: Pick<DiscoveryService, 'home'> } = {}) {
  const service = options.service ?? new DiscoveryService();
  for (const home of [true, false]) {
    app.get(home ? '/discovery/home' : '/discovery', async (request, reply) => {
      const parsed = (home ? DiscoveryQuerySchema.omit({ section: true }) : DiscoveryQuerySchema).safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ code: 'VALIDATION_ERROR', message: 'Invalid discovery parameters' });
      const { market, limit, currency } = parsed.data;
      const section = home ? undefined : DiscoverySectionKeySchema.parse('section' in parsed.data ? parsed.data.section : 'discover');
      if (!home && (section === 'under_25_usd' || section === 'under_50_usd') && currency && currency !== 'USD') {
        return reply.code(400).send({ code: 'VALIDATION_ERROR', message: 'USD budget sections require USD' });
      }
      try {
        const response = await service.home(market, limit, currency, section ? [section] : undefined);
        reply.header('Cache-Control', 'no-store'); // Recheck eligibility on every request.
        return DiscoveryHomeSchema.parse(response);
      } catch (error) {
        if (isAppError(error)) return reply.code(error.statusCode).send({ code: error.code, message: error.message });
        return reply.code(503).send({ code: 'SERVICE_UNAVAILABLE', message: 'Discovery is temporarily unavailable' });
      }
    });
  }
}
