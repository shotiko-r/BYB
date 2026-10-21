import { z } from 'zod';
import { validateFeedUrl } from './http.js';

const positiveLimit = (fallback: number, max: number) => z.coerce.number().int().positive().max(max).default(fallback);
export const feedEnvFields = {
  ADMITAD_ALIEXPRESS_FEED_URL: z.string().default('').refine(value => {
    if (!value) return true;
    try { validateFeedUrl(value); return true; } catch { return false; }
  }, 'Feed URL must be an HTTPS runtime secret without userinfo'),
  ADMITAD_ALIEXPRESS_FEED_ENABLED: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  ADMITAD_ALIEXPRESS_FEED_MARKETS: z.string().regex(/^[A-Z]{2}(,[A-Z]{2})*$/).default('GE'),
  ADMITAD_ALIEXPRESS_FEED_MAX_PRODUCTS: positiveLimit(5000, 1000000),
  ADMITAD_ALIEXPRESS_FEED_MAX_BYTES: positiveLimit(104857600, 2147483647),
  ADMITAD_ALIEXPRESS_FEED_MAX_DURATION_SECONDS: positiveLimit(120, 3600),
};
const FeedEnvSchema = z.object(feedEnvFields);

export interface FeedRunConfig {
  feedKey: 'aliexpress-ww';
  /** In-memory runtime secret. Never serialize this configuration. */
  url: string;
  markets: readonly string[];
  maxProducts: number;
  maxBytes: number;
  maxDurationMs: number;
  maxRecordSize: number;
}

export class FeedConfigError extends Error {
  constructor() { super('Invalid or disabled feed configuration'); this.name = 'FeedConfigError'; }
}

/** Independent of application env/database bootstrap; no DATABASE_URL needed. */
export function loadFeedConfig(environment: NodeJS.ProcessEnv): FeedRunConfig {
  const parsed = FeedEnvSchema.safeParse(environment);
  if (!parsed.success || !parsed.data.ADMITAD_ALIEXPRESS_FEED_ENABLED || !parsed.data.ADMITAD_ALIEXPRESS_FEED_URL) {
    throw new FeedConfigError();
  }
  const value = parsed.data;
  return { feedKey: 'aliexpress-ww', url: value.ADMITAD_ALIEXPRESS_FEED_URL,
    markets: value.ADMITAD_ALIEXPRESS_FEED_MARKETS.split(','), maxProducts: value.ADMITAD_ALIEXPRESS_FEED_MAX_PRODUCTS,
    maxBytes: value.ADMITAD_ALIEXPRESS_FEED_MAX_BYTES, maxDurationMs: value.ADMITAD_ALIEXPRESS_FEED_MAX_DURATION_SECONDS * 1000,
    maxRecordSize: 65536 };
}
