import type { ConciergeRecommendation, ProductWithOffers, SearchIntent } from '@byb/shared/types';

function hasFeature(product: ProductWithOffers, feature: string): boolean {
  return product.attributes[feature] === true
    || (Array.isArray(product.attributes.features) && product.attributes.features.includes(feature))
    || (feature === 'wireless' && typeof product.attributes.connectivity === 'string' && /bluetooth/i.test(product.attributes.connectivity));
}
function fitsUseCase(product: ProductWithOffers, useCase: string, category?: string): boolean {
  const direct = product.attributes.useCase;
  const list = product.attributes.useCases;
  if (typeof direct === 'string' && direct.toLowerCase() === useCase.toLowerCase()) return true;
  if (Array.isArray(list) && list.some(v => typeof v === 'string' && v.toLowerCase() === useCase.toLowerCase())) return true;
  // Limited, evidence-based headphone heuristics; no claims from missing metadata.
  if (category !== 'headphones') return false;
  const feature = { travel: 'noiseCancellation', workout: 'waterproof', office: 'microphone', gaming: 'microphone' }[useCase];
  return feature !== undefined && hasFeature(product, feature);
}

export function rankRecommendations(products: ProductWithOffers[], intent: SearchIntent): ConciergeRecommendation[] {
  const features = Array.isArray(intent.filters?.features) ? [...new Set(intent.filters.features as string[])] : [];
  const useCase = typeof intent.filters?.useCase === 'string' ? intent.filters.useCase : undefined;
  return products.map(product => {
    let earned = 0;
    let possible = 0;
    const reasons: string[] = [];
    if (intent.minPrice !== undefined || intent.maxPrice !== undefined) {
      possible += 30;
      const fits = product.offers.some(o => o.isActive && o.currencyCode === intent.currencyCode
        && (intent.minPrice === undefined || o.priceAmount >= intent.minPrice)
        && (intent.maxPrice === undefined || o.priceAmount <= intent.maxPrice));
      if (fits) { earned += 30; reasons.push(`Within your ${intent.currencyCode} budget`); }
    }
    if (intent.category) {
      possible += 25;
      if (product.category?.slug === intent.category || product.categoryId === intent.category) {
        earned += 25; reasons.push(`Matches category: ${product.category?.name || intent.category}`);
      }
    }
    if (features.length) {
      possible += 25;
      const matches = features.filter(f => hasFeature(product, f));
      earned += 25 * matches.length / features.length;
      if (matches.length) reasons.push(`Has requested features: ${matches.join(', ')}`);
    }
    if (intent.brand) {
      possible += 10;
      if (product.brand?.toLowerCase() === intent.brand.toLowerCase()) {
        earned += 10; reasons.push(`Matches preferred brand: ${product.brand}`);
      }
    }
    if (useCase) {
      possible += 10;
      if (fitsUseCase(product, useCase, intent.category)) { earned += 10; reasons.push(`Suitable for ${useCase} based on product attributes`); }
    }
    return { product, matchScore: possible ? Math.round(100 * earned / possible) : 0, reasons };
  }).sort((a, b) => b.matchScore - a.matchScore || (a.product.id < b.product.id ? -1 : a.product.id > b.product.id ? 1 : 0));
}
