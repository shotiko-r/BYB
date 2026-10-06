import type { FastifyInstance } from 'fastify';

export function registerHealth(app: FastifyInstance, checkDatabase: () => Promise<unknown>): void {
  app.get('/health', async (_request, reply) => {
    const timestamp = new Date().toISOString();
    try {
      await checkDatabase();
      return { status: 'ok', timestamp, version: '0.1.0', database: 'connected' };
    } catch {
      reply.code(503);
      return { status: 'degraded', timestamp, version: '0.1.0', database: 'disconnected' };
    }
  });
}

export function createShutdown(
  closeServer: () => Promise<unknown>, closeDatabase: () => Promise<unknown>,
  logError: (error: unknown) => void, finish: (code: number) => void,
): () => Promise<void> {
  let shutdown: Promise<void> | undefined;
  return () => {
    shutdown ??= (async () => {
      let code = 0;
      try { await closeServer(); } catch (error) { code = 1; logError(error); }
      try { await closeDatabase(); } catch (error) { code = 1; logError(error); }
      finish(code);
    })();
    return shutdown;
  };
}
