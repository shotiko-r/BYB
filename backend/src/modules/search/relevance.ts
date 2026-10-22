import type { SearchIntent } from '@byb/shared/types';
export interface RelevancePolicy { model?: string; brand?: string; terms?: string; query?: string; accessory?: boolean }
const accessoryRegex = /\b(case|cover|earpads?|ear[ -]?pads?|replacement|adapter|cable|charger|skin|protector)\b/gi;
const bundleRegex = /\b(with|includes|including|plus)[ -]+(a[ -]+)?(carrying[ -]+)?(case|cover)\b/gi;
export const BUNDLE_PATTERN = '\\m(with|includes|including|plus)[ -]+(a[ -]+)?(carrying[ -]+)?(case|cover)\\M';
export const ACCESSORY_PATTERN = '\\m(case|cover|earpads?|ear[ -]?pads?|replacement|adapter|cable|charger|skin|protector)\\M';
export function modelPattern(model: string): string {
  const normalized = model.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized ? `(^|[^a-z0-9])${normalized.split('').join('[^a-z0-9]*')}([^a-z0-9]|$)` : 'a^';
}
export function searchSpecificity(intent: SearchIntent): RelevancePolicy {
  const explicit = typeof intent.filters?.model === 'string' ? intent.filters.model.trim() : undefined;
  const accessory = Boolean(intent.filters?.accessory) || new RegExp(accessoryRegex.source, 'i').test((intent.query ?? '').replace(bundleRegex, ''));
  let text = (intent.query ?? '').replace(/\b(?:under|below|above|over|between|budget|less than|more than|up to|at most|maximum|spend|around|about)\b.*$/i, '')
    .replace(/[$€£₾]\s*\d+(?:[.,]\d+)?/g, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:USD|GEL|EUR|GBP|AMD|AZN|dollars?|lari)\b/gi, '')
    .replace(/\b(?:i|need|want|looking|for|a|an|the|please|buy|with|wireless|travel|office|gaming|workout)\b/gi, ' ');
  for (const field of [intent.brand, intent.category]) {
    if (field) text = text.replace(new RegExp(`\\b${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' ');
  }
  if (accessory) text = text.replace(accessoryRegex, ' ');
  text = text.trim().replace(/\s+/g, ' ');
  const tokens = text.match(/[a-z0-9]+/gi) ?? [];
  const modelLike = tokens.some(t => /[a-z]/i.test(t) && /\d/.test(t) && !/^\d+(?:gb|tb|mb|hz|khz|mhz|ghz|mah|mm|cm)$/i.test(t))
    || tokens.some((t, i) => /^\d+$/.test(t) && i > 0 && /^[a-z]{2,}$/i.test(tokens[i - 1]!));
  return { model: explicit || (modelLike ? text : undefined), brand: intent.brand, query: intent.query, accessory,
    terms: !modelLike && intent.brand && !intent.category && text ? text : undefined };
}
export function matchesRelevance(product: { name: string; model?: string | null; brand?: string | null }, policy: RelevancePolicy): boolean {
  const isAccessory = new RegExp(accessoryRegex.source, 'i').test(product.name.replace(bundleRegex, ''));
  if (!policy.model) return policy.accessory ? isAccessory : true;
  if (!/[a-z0-9]/i.test(policy.model.normalize('NFKC'))) return false;
  const pattern = new RegExp(modelPattern(policy.model), 'i');
  if (policy.brand && product.brand && product.brand.toLowerCase() !== policy.brand.toLowerCase()) return false;
  if (product.model && !pattern.test(product.model) && !pattern.test(product.name)) return false;
  return pattern.test(product.name) && (policy.accessory ? isAccessory : !isAccessory);
}

/** Small global SQL score from explicit evidence, evaluated before LIMIT/OFFSET. */
export function relevanceOrderSql(policy: RelevancePolicy, query: string | undefined, bind: (value: unknown) => string): string {
  const terms: string[] = [];
  if (policy.query || query) {
    const text = bind((policy.query || query)!.trim());
    terms.push(`CASE WHEN lower(p.name) = lower(${text}) THEN 200 WHEN p.name ILIKE '%' || ${text} || '%' THEN 40 ELSE 0 END`);
  }
  if (policy.model) {
    const model = bind(modelPattern(policy.model));
    terms.push(`CASE WHEN p.model ~* ${model} THEN 80 ELSE 0 END`);
  }
  if (policy.brand) {
    const brand = bind(policy.brand);
    terms.push(`CASE WHEN lower(p.brand) = lower(${brand}) THEN 20 ELSE 0 END`);
  }
  return terms.length ? `ORDER BY (${terms.join(' + ')}) DESC, p.name ASC, p.id ASC` : 'ORDER BY p.name ASC, p.id ASC';
}
