import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { registerHealth, createShutdown } from '../src/lifecycle.js';
import { EnvSchema } from '../src/config/env-schema.js';

describe('production lifecycle', () => {
  it.each([true, false])('readiness reports database availability: %s', async available => {
    const app = Fastify();
    registerHealth(app, async () => { if (!available) throw new Error('private database details'); });
    const response = await app.inject('/health');
    expect(response.statusCode).toBe(available ? 200 : 503);
    expect(response.json().database).toBe(available ? 'connected' : 'disconnected');
    expect(response.body).not.toContain('private');
    await app.close();
  });
  it('awaits server shutdown before pool shutdown and runs only once', async () => {
    const order: string[] = [];
    const server = vi.fn(async () => { await Promise.resolve(); order.push('server'); });
    const pool = vi.fn(async () => { order.push('pool'); });
    const finish = vi.fn();
    const shutdown = createShutdown(server, pool, vi.fn(), finish);
    await Promise.all([shutdown(), shutdown()]);
    expect(order).toEqual(['server', 'pool']);
    expect(server).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith(0);
  });
  it('still closes the pool when server close fails', async () => {
    const pool = vi.fn(async () => {}); const log = vi.fn(); const finish = vi.fn();
    await createShutdown(async () => { throw new Error('close failed'); }, pool, log, finish)();
    expect(pool).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith(1);
  });
  it('requires an exact production browser HTTPS origin, retaining development fallback', () => {
    const base = { DATABASE_URL: 'postgresql://example.invalid/byb' };
    expect(EnvSchema.parse(base).FRONTEND_URL).toBe('http://localhost:3000');
    for (const origin of [undefined, 'http://localhost:3000', 'https://localhost', 'https://example.invalid/path', 'bad']) {
      expect(EnvSchema.safeParse({ ...base, NODE_ENV: 'production', FRONTEND_URL: origin }).success).toBe(false);
    }
    expect(EnvSchema.parse({ ...base, NODE_ENV: 'production', FRONTEND_URL: 'https://example.invalid' }).FRONTEND_URL)
      .toBe('https://example.invalid');
  });
});
