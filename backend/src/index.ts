import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
// CORS is handled via onRequest hook
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { pool, closePool } from './config/database.js';
import { marketRoutes } from './modules/market/routes.js';
import { productRoutes } from './modules/product/routes.js';
import { merchantRoutes } from './modules/merchant/routes.js';
import { conciergeRoutes } from './modules/ai/routes.js';
import { searchRoutes } from './modules/search/routes.js';
import { providerRegistry } from './modules/provider/registry.js';
import { AmazonProvider, TemuProvider, AliExpressProvider, EbayProvider } from './modules/provider/mock/index.js';

const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:3000'];

app.addHook('onRequest', (request, reply, done) => {
  const origin = request.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
  }
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (request.method === 'OPTIONS') {
    reply.status(204).send();
    return;
  }
  done();
});

app.get('/health', async () => {
  try {
    await pool.query('SELECT 1');
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      database: 'connected' as const,
    };
  } catch {
    return {
      status: 'degraded' as const,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      database: 'disconnected' as const,
    };
  }
});

void app.register(marketRoutes, { prefix: '/api' });
void app.register(productRoutes, { prefix: '/api' });
void app.register(merchantRoutes, { prefix: '/api' });
void app.register(searchRoutes, { prefix: '/api' });
void app.register(conciergeRoutes, { prefix: '/api' });

function registerMockProviders() {
  providerRegistry.register(new AmazonProvider());
  providerRegistry.register(new TemuProvider());
  providerRegistry.register(new AliExpressProvider());
  providerRegistry.register(new EbayProvider());
}

async function start() {
  try {
    registerMockProviders();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`Server listening on port ${env.PORT}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

const shutdown = () => {
  logger.info('Shutting down...');
  void closePool();
  void app.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

void start();