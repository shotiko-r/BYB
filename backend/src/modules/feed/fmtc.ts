import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ProviderProductSchema, type ProviderProduct } from '@byb/shared/types';
import { parseFeedMoney } from './money.js';
import type { FeedRepository } from './repository.js';

export const FMTC_FEED_KEY = 'fmtc-rakuten-62058';
const PAGE_SIZE = 10;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15000;
export class FmtcError extends Error {
  constructor(readonly code: string) { super(`FMTC import failed: ${code}`); }
}
function hasControl(value: string, allowWhitespace = false): boolean {
  return [...value].some(c => { const n = c.codePointAt(0)!; return (n < 32 || n === 127) && !(allowWhitespace && [9, 10, 13].includes(n)); });
}
export function loadFmtcConfig(env: NodeJS.ProcessEnv): { token: string } {
  const token = env.FMTC_API_TOKEN;
  if (!token || token.length > 2048 || (/\s/.test(token) || hasControl(token))) throw new FmtcError('CONFIG');
  return { token };
}
const money = z.union([z.string(), z.number().finite()]);
const rowSchema = z.object({
  product_id: z.union([z.string(), z.number().int().safe()]), merchant_id: z.literal(62058), network_id: z.literal(2),
  label: z.string(), price: money, sale_price: money.nullish(), currency_code: z.string(), affiliate_url: z.string(),
  image_link: z.string().nullish(), raw_brand_name: z.string().nullish(), description: z.string().nullish(),
  gtin: z.string().nullish(), additional_details: z.record(z.unknown()).nullish(),
});
const responseSchema = z.object({ data: z.array(z.unknown()).max(PAGE_SIZE) });
export type FmtcProduct = ProviderProduct & { providerCode: 'aliexpress'; merchantName: 'AliExpress'; externalProductId: string; sourceIdentity: string };
function safeUrl(value: string, limit: number): boolean {
  if (value.length > limit || (/[\s\\]/.test(value) || hasControl(value))) return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password; } catch { return false; }
}
function clean(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !hasControl(value, true) ? value.trim() : undefined;
}
export function mapFmtcProduct(input: unknown): FmtcProduct {
  const parsed = rowSchema.safeParse(input);
  if (!parsed.success) throw new FmtcError('INVALID_PRODUCT');
  const r = parsed.data;
  const id = String(r.product_id);
  const name = clean(r.label, 300);
  if (!id || id.length > 200 || hasControl(id) || !name || !safeUrl(r.affiliate_url, 1000)) throw new FmtcError('INVALID_PRODUCT');
  let priceAmount: number;
  let oldPriceAmount: number | undefined;
  try {
    const regular = parseFeedMoney(String(r.price), r.currency_code);
    let sale: number | undefined;
    try { if (r.sale_price != null) sale = parseFeedMoney(String(r.sale_price), r.currency_code); } catch { /* invalid sale is ignored */ }
    priceAmount = regular;
    if (sale !== undefined && sale > 0 && regular > 0 && sale < regular) {
      priceAmount = sale;
      oldPriceAmount = regular;
    }
  } catch { throw new FmtcError('INVALID_PRICE'); }
  const sourceIdentity = `aliexpress-${createHash('sha256').update(`${FMTC_FEED_KEY}\0${id}`).digest('hex')}`;
  const gtin = clean(r.gtin, 100); const sku = clean(r.additional_details?.sku, 200);
  const result = ProviderProductSchema.safeParse({ externalId: id, name, description: clean(r.description, 10000),
    brand: clean(r.raw_brand_name, 200), imageUrl: r.image_link && safeUrl(r.image_link, 500) ? r.image_link : undefined,
    attributes: { ...(gtin ? { gtin } : {}), ...(sku ? { sku } : {}) }, priceAmount, currencyCode: r.currency_code,
    availability: 'unknown', shippingInfo: { shipping: 'unknown', tax: 'unknown' }, destinationUrl: r.affiliate_url,
    affiliateMetadata: oldPriceAmount === undefined ? {} : { oldPriceAmount, oldPriceCurrencyCode: r.currency_code } });
  if (!result.success) throw new FmtcError('INVALID_PRODUCT');
  return { ...result.data, providerCode: 'aliexpress', merchantName: 'AliExpress', externalProductId: id, sourceIdentity };
}
export async function fetchFmtcPage(config: { token: string }, transport: typeof fetch = fetch): Promise<FmtcProduct[]> {
  const url = new URL('https://s3.fmtc.co/api/1/products');
  url.search = new URLSearchParams({ api_token: config.token, merchant_ids: '62058', network_id: '2', page_size: String(PAGE_SIZE), format: 'json' }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await transport(url, { signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new FmtcError(response.status === 401 || response.status === 403 ? 'AUTH' : 'HTTP');
    if (!response.body) throw new FmtcError('EMPTY_BODY');
    const reader = (response.body as ReadableStream<Uint8Array>).getReader(); const chunks: Uint8Array[] = []; let total = 0;
    try { let finished = false; while (!finished) { const result = await reader.read(); if (result.done) { finished = true; continue; } const value = result.value; total += value.length; if (total > MAX_BYTES) throw new FmtcError('BYTE_LIMIT'); chunks.push(value); } }
    finally { await reader.cancel().catch(() => {}); }
    let json: unknown; try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new FmtcError('INVALID_JSON'); }
    const validated = responseSchema.safeParse(json); if (!validated.success) throw new FmtcError('INVALID_RESPONSE');
    return validated.data.data.map(mapFmtcProduct);
  } catch (error) { if (error instanceof FmtcError) throw error; throw new FmtcError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK'); }
  finally { clearTimeout(timer); }
}
export async function importFmtc(config: { token: string }, repository: FeedRepository, transport: typeof fetch = fetch): Promise<number> {
  const markets = ['GE'];
  return repository.withLocks(FMTC_FEED_KEY, markets, async () => {
    const products = await fetchFmtcPage(config, transport);
    return products.length ? repository.writeBatch(products, { feedKey: FMTC_FEED_KEY, markets, syncRunId: randomUUID() }) : 0;
  });
}
