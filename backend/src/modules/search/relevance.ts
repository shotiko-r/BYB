import type { SearchIntent } from '@byb/shared/types';
export interface RelevancePolicy { model?: string; brand?: string; terms?: string }
export const BUNDLE_PATTERN = '\\m(with|includes|including|plus)[ -]+(a[ -]+)?(carrying[ -]+)?(case|cover)\\M';
export const ACCESSORY_PATTERN = '\\m(case|cover|earpads?|ear[ -]?pads?|replacement|adapter|cable|charger|skin|protector)\\M';
export function modelPattern(model: string): string {
  const normalized = model.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized ? `(^|[^a-z0-9])${normalized.split('').join('[^a-z0-9]*')}([^a-z0-9]|$)` : 'a^';
}
export function searchSpecificity(intent: SearchIntent): RelevancePolicy {
  const explicit = typeof intent.filters?.model === 'string' ? intent.filters.model.trim() : undefined;
  let text = (intent.query ?? '').replace(/\b(?:under|below|above|over|between|budget|less than|more than|up to|at most|maximum|spend|around|about)\b.*$/i, '')
    .replace(/[$€£₾]\s*\d+(?:[.,]\d+)?/g, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:USD|GEL|EUR|GBP|AMD|AZN|dollars?|lari)\b/gi, '')
    .replace(/\b(?:i|need|want|looking|for|a|an|the|please|buy|with|wireless|travel|office|gaming|workout)\b/gi, ' ');
  for (const field of [intent.brand, intent.category]) {
    if (field) text = text.replace(new RegExp(`\\b${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' ');
  }
  text = text.trim().replace(/\s+/g, ' ');
  const tokens = text.match(/[a-z0-9]+/gi) ?? [];
  const modelLike = tokens.some(t => /[a-z]/i.test(t) && /\d/.test(t) && !/^\d+(?:gb|tb|mb|hz|khz|mhz|ghz|mah|mm|cm)$/i.test(t))
    || tokens.some((t, i) => /^\d+$/.test(t) && i > 0 && /^[a-z]{2,}$/i.test(tokens[i - 1]!));
  return { model: explicit || (modelLike ? text : undefined), brand: intent.brand,
    terms: !modelLike && intent.brand && !intent.category && text ? text : undefined };
}
export function matchesRelevance(product: { name: string; model?: string | null; brand?: string | null }, policy: RelevancePolicy): boolean {
  if (!policy.model) return true;
  if (!/[a-z0-9]/i.test(policy.model.normalize('NFKC'))) return false;
  const pattern = new RegExp(modelPattern(policy.model), 'i');
  if (policy.brand && product.brand && product.brand.toLowerCase() !== policy.brand.toLowerCase()) return false;
  if (product.model && !pattern.test(product.model) && !pattern.test(product.name)) return false;
  return pattern.test(product.name) && !/\b(case|cover|earpads?|ear[ -]?pads?|replacement|adapter|cable|charger|skin|protector)\b/i.test(product.name.replace(/\b(with|includes|including|plus)[ -]+(a[ -]+)?(carrying[ -]+)?(case|cover)\b/gi, ''));
}
