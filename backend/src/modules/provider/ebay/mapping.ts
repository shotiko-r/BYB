import { convert } from 'html-to-text';
import { z } from 'zod';
import { ProviderProductSchema, type ProviderProduct, type SearchIntent } from '@byb/shared/types';

const featureTerms: Record<string, string> = { noiseCancellation: 'noise cancelling', wireless: 'wireless', microphone: 'microphone', waterproof: 'waterproof' };
const MAX_DESCRIPTION_INPUT = 200_000;
const MAX_DESCRIPTION_LENGTH = 20_000;
const MAX_IMAGE_URL_LENGTH = 2_000;
const MAX_IMAGES = 12;
const MAX_ASPECTS = 40;
const MAX_ASPECT_NAME_LENGTH = 80;
const MAX_ASPECT_VALUE_LENGTH = 500;
// eBay image CDN domains used by Browse API image containers.
const EBAY_IMAGE_DOMAINS = ['ebayimg.com', 'ebaystatic.com'] as const;
const ignoredAspectValues = new Set(['unknown', 'n/a', 'na', 'does not apply', 'not applicable', 'none', 'null', 'not specified', 'unspecified']);
const privateAspectNames = new Set(['seller', 'seller notes', "seller's notes", 'private', 'internal', 'listing identity', 'source', 'condition id', 'affiliate metadata']);

type Aspect = { name: string; value: string };
export function keywords(intent: SearchIntent): string {
  const features = Array.isArray(intent.filters?.features) ? intent.filters.features : [];
  const model = typeof intent.filters?.model === 'string' ? intent.filters.model : undefined;
  return [...new Set([intent.query, intent.category?.replace(/-/g, ' '), intent.brand, model,
    ...features.filter((f): f is string => typeof f === 'string').map(f => featureTerms[f]).filter(Boolean),
  ].filter((value): value is string => Boolean(value)))].join(' ').trim().slice(0, 100) || 'products';
}
export function minorUnits(value: string, currency: string): number {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Unsupported money');
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match || (match[2]?.length ?? 0) > digits) throw new Error('Invalid money');
  const amount = BigInt(match[1]!) * 10n ** BigInt(digits) + BigInt((match[2] || '').padEnd(digits, '0') || '0');
  // offers.price_amount is PostgreSQL INTEGER.
  if (amount > 2147483647n) throw new Error('Money out of range');
  return Number(amount);
}
function stripControlCharacters(value: string, keepLineBreaks: boolean, replacement = ''): string {
  let result = '';
  for (const char of value) {
    const code = char.codePointAt(0)!;
    const lineBreak = char === '\n' || char === '\r' || char === '\t';
    result += code === 0x7F || (code < 0x20 && !(keepLineBreaks && lineBreak)) ? replacement : char;
  }
  return result;
}
function cleanText(value: string, maxLength: number): string | undefined {
  const text = stripControlCharacters(value, true).replace(/\u00A0/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text ? text.slice(0, maxLength).trim() || undefined : undefined;
}
function cleanAspectText(value: string, maxLength: number): string | undefined {
  const text = stripControlCharacters(value, false, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, maxLength).trim() || undefined : undefined;
}
function plainText(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const text = convert(value.slice(0, MAX_DESCRIPTION_INPUT), {
      wordwrap: false,
      decodeEntities: true,
      selectors: [
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'iframe', format: 'skip' },
        { selector: 'form', format: 'skip' },
        { selector: 'img', format: 'skip' },
        { selector: 'object', format: 'skip' },
        { selector: 'embed', format: 'skip' },
        { selector: 'a', options: { ignoreHref: true } },
      ],
      limits: { maxInputLength: MAX_DESCRIPTION_INPUT, ellipsis: '' },
    });
    return cleanText(text, MAX_DESCRIPTION_LENGTH);
  } catch { return undefined; }
}
function validImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const candidate = value.trim();
  if (!candidate || candidate.length > MAX_IMAGE_URL_LENGTH) return undefined;
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.hash
      || !EBAY_IMAGE_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) return undefined;
    return url.toString();
  } catch { return undefined; }
}
function imageUrl(value: unknown): string | undefined {
  if (typeof value === 'string') return validImageUrl(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return validImageUrl((value as Record<string, unknown>).imageUrl);
}
function imageUrls(primary: unknown, additional: unknown): string[] {
  const images: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    const url = imageUrl(value);
    if (!url || seen.has(url) || images.length >= MAX_IMAGES) return;
    seen.add(url);
    images.push(url);
  };
  add(primary);
  if (Array.isArray(additional)) for (const item of additional) add(item);
  return images;
}
function readAspects(input: unknown): Aspect[] {
  if (!Array.isArray(input)) return [];
  const aspects: Aspect[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const source = entry as Record<string, unknown>;
    if (typeof source.name !== 'string' || typeof source.value !== 'string') continue;
    const name = cleanAspectText(source.name, MAX_ASPECT_NAME_LENGTH);
    const value = cleanAspectText(source.value, MAX_ASPECT_VALUE_LENGTH);
    if (!name || !value || privateAspectNames.has(name.toLowerCase()) || ignoredAspectValues.has(value.toLowerCase())) continue;
    aspects.push({ name, value });
  }
  return aspects;
}
function uniqueAspects(aspects: Aspect[]): Aspect[] {
  const unique: Aspect[] = [];
  const seen = new Set<string>();
  for (const aspect of aspects) {
    const key = `${aspect.name.toLowerCase()}\u0000${aspect.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(aspect);
    if (unique.length >= MAX_ASPECTS) break;
  }
  return unique;
}
const itemBaseSchema = z.object({
  itemId: z.string().min(1).max(200), title: z.string().min(1).max(300),
  price: z.object({ value: z.string(), currency: z.string() }), itemWebUrl: z.string().url(),
  image: z.object({ imageUrl: z.string().url() }).optional(),
  condition: z.string().optional(), conditionId: z.string().optional(),
  buyingOptions: z.array(z.string()), listingMarketplaceId: z.string().optional(), epid: z.string().optional(),
  categories: z.array(z.object({ categoryId: z.string(), categoryName: z.string() })).optional(),
  seller: z.object({ feedbackPercentage: z.string().optional(), feedbackScore: z.number().optional() }).optional(),
  itemLocation: z.object({ country: z.string().optional() }).optional(),
  shippingOptions: z.array(z.object({ shippingCost: z.object({ value: z.string(), currency: z.string() }).optional(),
    shippingCostType: z.string().optional(), type: z.string().optional(),
    shippingServiceCode: z.string().optional().catch(undefined), shippingCarrierCode: z.string().optional().catch(undefined),
    minEstimatedDeliveryDate: z.string().datetime({ offset: true }).optional().catch(undefined),
    maxEstimatedDeliveryDate: z.string().datetime({ offset: true }).optional().catch(undefined),
    shipToLocationUsedForEstimate: z.object({ country: z.string().regex(/^[A-Z]{2}$/).optional() }).optional().catch(undefined),
  })).optional(),
});
const itemSchema = itemBaseSchema.extend({
  localizedAspects: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
});
const detailItemSchema = itemBaseSchema.extend({
  image: z.object({ imageUrl: z.unknown() }).optional().catch(undefined),
  description: z.string().optional().catch(undefined), shortDescription: z.string().optional().catch(undefined),
  additionalImages: z.array(z.unknown()).optional().catch(undefined),
  localizedAspects: z.array(z.unknown()).optional().catch(undefined),
});
export function mapItem(input: unknown, options: { detail?: boolean } = {}): ProviderProduct | null {
  const detail = options.detail === true;
  const parsed = (detail ? detailItemSchema : itemSchema).safeParse(input);
  if (!parsed.success || !parsed.data.buyingOptions.includes('FIXED_PRICE')) return null;
  const item = parsed.data as z.infer<typeof detailItemSchema>;
  const destination = new URL(item.itemWebUrl);
  if (destination.protocol !== 'https:' || destination.username || destination.password
    || !['ebay.com', 'www.ebay.com', 'www.ebay.ca', 'www.ebay.co.uk', 'www.ebay.de', 'www.ebay.fr'].includes(destination.hostname)) return null;
  try {
    const categoryNames = item.categories?.map(c => c.categoryName).join(' ').toLowerCase() ?? '';
    const category = /headphone|earbud|earphone/.test(categoryNames) ? 'headphones'
      : /cell phone|smartphone/.test(categoryNames) ? 'smartphones' : /laptop|notebook/.test(categoryNames) ? 'laptops' : undefined;
    const rawAspects = item.localizedAspects ?? [];
    const aspects: Aspect[] = detail ? readAspects(rawAspects) : rawAspects as Aspect[];
    const brand = aspects.find(a => a.name.toLowerCase() === 'brand')?.value;
    const model = aspects.find(a => a.name.toLowerCase() === 'model')?.value;
    const featureEvidence = aspects.filter(a => /^(features|connectivity|microphone type)$/i.test(a.name)).map(a => a.value).join(' ').toLowerCase();
    const features = [
      /active noise cancel|noise cancellation|noise cancelling/.test(featureEvidence) ? 'noiseCancellation' : undefined,
      /wireless|bluetooth/.test(featureEvidence) ? 'wireless' : undefined,
      /microphone/.test(featureEvidence) ? 'microphone' : undefined,
      /waterproof/.test(featureEvidence) ? 'waterproof' : undefined,
    ].filter(Boolean);
    const shippingOptions = item.shippingOptions?.map(option => ({ ...option,
      shippingCost: option.shippingCost ? { amount: minorUnits(option.shippingCost.value, option.shippingCost.currency), currencyCode: option.shippingCost.currency } : undefined,
    }));
    const images = detail ? imageUrls(item.image?.imageUrl, item.additionalImages) : [];
    const detailAspects = detail ? uniqueAspects(aspects) : [];
    const description = detail ? plainText(item.description) ?? plainText(item.shortDescription) : undefined;
    // Seller username is intentionally NOT retained: compliance has no account mapping.
    const attributes = { source: 'ebay_browse', listingIdentity: item.itemId, condition: item.condition,
      conditionId: item.conditionId, categories: item.categories, features,
      seller: item.seller, buyingOptions: item.buyingOptions, listingMarketplaceId: item.listingMarketplaceId,
      epid: item.epid, itemLocationCountry: item.itemLocation?.country,
      ...(images.length ? { images } : {}), ...(detailAspects.length ? { aspects: detailAspects } : {}) };
    const result = ProviderProductSchema.safeParse({ externalId: item.itemId, name: item.title, brand, model, category,
      priceAmount: minorUnits(item.price.value, item.price.currency), currencyCode: item.price.currency,
      imageUrl: detail ? images[0] : item.image?.imageUrl, destinationUrl: item.itemWebUrl, availability: 'unknown',
      description, attributes, shippingInfo: { options: shippingOptions }, affiliateMetadata: {},
    });
    return result.success ? result.data : null;
  } catch { return null; }
}
