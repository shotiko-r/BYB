import { createHash } from 'node:crypto';
import { ProviderProductSchema, type ProviderProduct } from '@byb/shared/types';
import { DEFAULT_CURRENCY_EXPONENTS, FeedMoneyError, parseFeedMoney } from '../money.js';
import { parseFeedParams } from '../params.js';
import type { CurrencyExponents, FeedIssue, FeedMapper } from '../types.js';

export const ALIEXPRESS_HEADERS = ['id', 'name', 'url', 'category', 'currencyId', 'param', 'picture', 'oldprice', 'price'] as const;
export interface AliExpressFeedContext {
  /** Logical program key, never a URL or credential. */
  programNamespace: string;
  currencyExponents?: CurrencyExponents;
}
export type AliExpressFeedProduct = ProviderProduct & {
  providerCode: 'aliexpress';
  merchantName: 'AliExpress';
  externalProductId: string;
  sourceIdentity: string;
};

function hasControl(value: string, allowTextWhitespace = false): boolean {
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if ((code < 32 || code === 127) && !(allowTextWhitespace && [9, 10, 13].includes(code))) return true;
  }
  return false;
}

function safeUrl(value: string, maxLength: number): boolean {
  if (!/^https?:\/\//i.test(value) || value.length > maxLength || /[\\\s]/u.test(value) || hasControl(value)) return false;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

export const mapAliExpressRow: FeedMapper<AliExpressFeedProduct, AliExpressFeedContext> = (row, context) => {
  const issues: FeedIssue[] = [];
  const warnings: FeedIssue[] = [];
  if (!/^aliexpress-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(context.programNamespace) || context.programNamespace.length > 100) {
    return { ok: false, issues: [{ field: 'programNamespace', code: 'INVALID_NAMESPACE' }] };
  }
  for (const header of ALIEXPRESS_HEADERS) {
    if (typeof row[header] !== 'string') issues.push({ field: header, code: 'MISSING_FIELD' });
  }
  if (issues.length) return { ok: false, issues };
  const id = row.id!;
  const name = row.name!.trim();
  const currency = row.currencyId!;
  if (!/^\d{1,200}$/.test(id)) issues.push({ field: 'id', code: 'INVALID_ID' });
  if (!name || name.length > 300 || hasControl(name, true)) issues.push({ field: 'name', code: 'INVALID_NAME' });
  if (row.category!.length > 2000) issues.push({ field: 'category', code: 'CATEGORY_TOO_LONG' });
  if (!safeUrl(row.url!, 1000)) issues.push({ field: 'url', code: 'INVALID_URL' });
  if (!safeUrl(row.picture!, 500)) issues.push({ field: 'picture', code: 'INVALID_URL' });
  const exponents = context.currencyExponents ?? DEFAULT_CURRENCY_EXPONENTS;
  let priceAmount = 0;
  let oldPriceAmount: number | undefined;
  try { priceAmount = parseFeedMoney(row.price!, currency, exponents); }
  catch (error) { issues.push({ field: 'price', code: error instanceof FeedMoneyError ? error.code : 'INVALID_MONEY' }); }
  if (row.oldprice!.trim()) {
    try { oldPriceAmount = parseFeedMoney(row.oldprice!, currency, exponents); }
    catch { warnings.push({ field: 'oldprice', code: 'INVALID_OLD_PRICE' }); }
  }
  if (issues.length) return { ok: false, issues };
  const sourceIdentity = `aliexpress-${createHash('sha256').update(`${context.programNamespace}\0${id}`).digest('hex')}`;
  const metadata = { ...parseFeedParams(row.param!), merchantCategory: row.category!,
    ...(oldPriceAmount === undefined ? {} : { oldPriceAmount, oldPriceCurrencyCode: currency }),
    _byb: { provenance: { version: 1, provider: 'aliexpress', mode: 'real', environment: 'production' },
      sourceType: 'admitad-feed', feed: { key: context.programNamespace, mapperVersion: 1 } } };
  const parsed = ProviderProductSchema.safeParse({ externalId: id, name, imageUrl: row.picture!,
    attributes: { source: 'admitad-feed', sourceIdentity }, priceAmount, currencyCode: currency,
    availability: 'unknown', shippingInfo: { shipping: 'unknown', tax: 'unknown' },
    destinationUrl: row.url!, affiliateMetadata: metadata });
  if (!parsed.success) return { ok: false, issues: [{ field: 'row', code: 'INVALID_PRODUCT' }] };
  return { ok: true, warnings, value: { ...parsed.data, providerCode: 'aliexpress', merchantName: 'AliExpress',
    externalProductId: id, sourceIdentity } };
};
