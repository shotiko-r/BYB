import { z } from 'zod';
import { VerificationTokenSchema } from '../modules/ebay/account-deletion.js';
import { feedEnvFields } from '../modules/feed/config.js';

export const EnvSchema = z.object({
  ...feedEnvFields,
  // Search/runtime never requires or validates the importer-only credential URL.
  ADMITAD_ALIEXPRESS_FEED_URL: z.unknown().transform(() => undefined),
  ALIEXPRESS_SEARCH_ENABLED: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  ADMITAD_ALIEXPRESS_FEED_MAX_AGE_HOURS: z.coerce.number().positive().max(8760).default(24),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url().regex(/^postgres(?:ql)?:\/\//, 'DATABASE_URL must use postgres:// or postgresql://'),
  FRONTEND_URL: z.string().url().optional(),
  EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN: z.preprocess(value => value === '' ? undefined : value, VerificationTokenSchema.optional()),
  EBAY_PROVIDER_MODE: z.enum(['mock', 'real']).default('mock'),
  EBAY_ENVIRONMENT: z.enum(['sandbox', 'production']).default('production'),
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
}).superRefine((value, context) => {
  if (value.EBAY_PROVIDER_MODE === 'real' && (!value.EBAY_CLIENT_ID?.trim() || !value.EBAY_CLIENT_SECRET?.trim())) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['EBAY_PROVIDER_MODE'], message: 'Real eBay mode requires backend client credentials' });
  }
  if (value.NODE_ENV !== 'production') return;
  let url: URL | undefined;
  try { url = value.FRONTEND_URL ? new URL(value.FRONTEND_URL) : undefined; } catch { /* Invalid URL is reported below. */ }
  if (!url || url.protocol !== 'https:' || url.origin !== value.FRONTEND_URL ||
      url.username || url.password || (['localhost', '0.0.0.0', '[::]', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.localhost') || /^127\./.test(url.hostname))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['FRONTEND_URL'],
      message: 'Production FRONTEND_URL must be an explicit public HTTPS origin (no path or trailing slash)' });
  }
}).transform(value => ({ ...value, FRONTEND_URL: value.FRONTEND_URL ?? 'http://localhost:3000' }));
