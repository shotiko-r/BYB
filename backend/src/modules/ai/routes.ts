import type { FastifyInstance } from 'fastify';
import { ConciergeResponseSchema } from '@byb/shared/types';
import { ConciergeService } from './concierge.js';
import { serializeConciergeResponse } from './serialization.js';
import { isAppError } from '../../shared/errors.js';
import { logger } from '../../config/logger.js';

export async function conciergeRoutes(app: FastifyInstance, options: { service?: Pick<ConciergeService, 'respond'> } = {}) {
  const service = options.service ?? new ConciergeService();
  app.post('/concierge', async (request, reply) => {
    let stage = 'search and ranking';
    try {
      const response = await service.respond(request.body);
      stage = 'serialization';
      const serialized = serializeConciergeResponse(response);
      stage = 'response validation';
      return ConciergeResponseSchema.parse(serialized);
    } catch (error) {
      if (isAppError(error)) return reply.code(error.statusCode).send({ code: error.code, message: error.message, details: error.details });
      logger.error({ err: error, stage, requestId: request.id }, 'Concierge response failed');
      return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Unable to complete your request. Please try again.' });
    }
  });
}
