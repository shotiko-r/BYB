import type { FastifyInstance } from 'fastify';
import { VerificationTokenSchema, AccountDeletionNotificationSchema, challengeResponse, handleAccountDeletion } from './account-deletion.js';

// Fastify's async plugin contract; registration itself needs no I/O.
// eslint-disable-next-line @typescript-eslint/require-await
export async function accountDeletionRoutes(app: FastifyInstance, options: {
  verificationToken?: string;
  logOutcome?: (outcome: string) => void;
}) {
  const token = options.verificationToken ? VerificationTokenSchema.parse(options.verificationToken) : undefined;
  // Encapsulated error handler: never include parser/validation input or exceptions.
  app.setErrorHandler((error, _request, reply) => {
    const status = error.statusCode === 413 ? 413 : error.statusCode === 415 ? 415 : 400;
    void reply.code(status).send({ code: 'INVALID_NOTIFICATION', message: 'Invalid notification request' });
  });
  app.get('/ebay/account-deletion', (request, reply) => {
    if (!token) return reply.code(503).send({ code: 'NOT_CONFIGURED', message: 'Notification endpoint is not configured' });
    const values = new URL(request.raw.url || '/', 'https://callback.invalid').searchParams.getAll('challenge_code');
    const challenge = values[0];
    if (values.length !== 1 || !challenge?.trim() || challenge.length > 2048) {
      return reply.code(400).send({ code: 'INVALID_CHALLENGE', message: 'Invalid challenge request' });
    }
    return reply.header('Cache-Control', 'no-store').send({ challengeResponse: challengeResponse(challenge, token) });
  });
  app.post('/ebay/account-deletion', { bodyLimit: 65536 }, (request, reply) => {
    if (!token) return reply.code(503).send({ code: 'NOT_CONFIGURED', message: 'Notification endpoint is not configured' });
    if (!AccountDeletionNotificationSchema.safeParse(request.body).success) {
      return reply.code(400).send({ code: 'INVALID_NOTIFICATION', message: 'Invalid notification request' });
    }
    // Receipt acknowledgement only. Schema validation does not authenticate eBay.
    // No account-related processing, payload retention, or database access occurs.
    options.logOutcome?.(handleAccountDeletion());
    return reply.code(204).send();
  });
}
