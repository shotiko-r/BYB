import { z } from 'zod';
import { ProviderProductSchema, type ProviderProduct, type SearchIntent } from '@byb/shared/types';

const featureTerms: Record<string, string> = { noiseCancellation: 'noise cancelling', wireless: 'wireless', microphone: 'microphone', waterproof: 'waterproof' };
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
const itemSchema = z.object({
  itemId: z.string().min(1).max(200), title: z.string().min(1).max(300),
  price: z.object({ value: z.string(), currency: z.string() }), itemWebUrl: z.string().url(),
  image: z.object({ imageUrl: z.string().url() }).optional(),
  condition: z.string().optional(), conditionId: z.string().optional(),
  buyingOptions: z.array(z.string()), listingMarketplaceId: z.string().optional(), epid: z.string().optional(),
  categories: z.array(z.object({ categoryId: z.string(), categoryName: z.string() })).optional(),
  seller: z.object({ feedbackPercentage: z.string().optional(), feedbackScore: z.number().optional() }).optional(),
  itemLocation: z.object({ country: z.string().optional() }).optional(),
  shippingOptions: z.array(z.object({ shippingCost: z.object({ value: z.string(), currency: z.string() }).optional(),
    shippingCostType: z.string().optional(), type: z.string().optional() })).optional(),
  localizedAspects: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
});
export function mapItem(input: unknown): ProviderProduct | null {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success || !parsed.data.buyingOptions.includes('FIXED_PRICE')) return null;
  const item = parsed.data;
  const destination = new URL(item.itemWebUrl);
  if (destination.protocol !== 'https:' || destination.username || destination.password
    || !['ebay.com', 'www.ebay.com', 'www.ebay.ca', 'www.ebay.co.uk', 'www.ebay.de', 'www.ebay.fr'].includes(destination.hostname)) return null;
  try {
    const categoryNames = item.categories?.map(c => c.categoryName).join(' ').toLowerCase() ?? '';
    const category = /headphone|earbud|earphone/.test(categoryNames) ? 'headphones'
      : /cell phone|smartphone/.test(categoryNames) ? 'smartphones' : /laptop|notebook/.test(categoryNames) ? 'laptops' : undefined;
    const aspects = item.localizedAspects ?? [];
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
    // Seller username is intentionally NOT retained: compliance has no account mapping.
    const attributes = { source: 'ebay_browse', listingIdentity: item.itemId, condition: item.condition,
      conditionId: item.conditionId, categories: item.categories, features,
      seller: item.seller, buyingOptions: item.buyingOptions, listingMarketplaceId: item.listingMarketplaceId,
      epid: item.epid, itemLocationCountry: item.itemLocation?.country };
    const result = ProviderProductSchema.safeParse({ externalId: item.itemId, name: item.title, brand, model, category,
      priceAmount: minorUnits(item.price.value, item.price.currency), currencyCode: item.price.currency,
      imageUrl: item.image?.imageUrl, destinationUrl: item.itemWebUrl, availability: 'unknown',
      attributes, shippingInfo: { options: shippingOptions }, affiliateMetadata: {},
    });
    return result.success ? result.data : null;
  } catch { return null; }
}
