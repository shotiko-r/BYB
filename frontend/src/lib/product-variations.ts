import type { VariationGroup } from '@byb/shared/types';
import type { ProductWithOffers } from '@/types';

export function productVariationGroup(product: ProductWithOffers): VariationGroup | undefined {
  return product.attributes.source === 'ebay_browse' && product.offers.some(offer => offer.isActive && offer.merchant?.code === 'ebay')
    && product.variationGroup && product.variationGroup.variants.length > 1 ? product.variationGroup : undefined;
}
export function initialSelections(product: ProductWithOffers, group?: VariationGroup): Record<string, string> {
  const offer = product.offers.find(offer => offer.isActive && offer.merchant?.code === 'ebay');
  return group?.variants.find(variant => variant.externalProductId === offer?.externalProductId)?.selections ?? {};
}
export function matchingVariant(group: VariationGroup, selections: Record<string, string>) {
  return group.variants.find(variant => group.dimensions.every(dimension => selections[dimension.name] === variant.selections[dimension.name]));
}
export function variationOptionEnabled(group: VariationGroup, selections: Record<string, string>, name: string, value: string) {
  return group.variants.some(variant => variant.availability !== 'out_of_stock' && variant.selections[name] === value
    && group.dimensions.every(dimension => dimension.name === name || !selections[dimension.name]
      || variant.selections[dimension.name] === selections[dimension.name]));
}
export function variationProduct(product: ProductWithOffers, group: VariationGroup, selections: Record<string, string>): ProductWithOffers {
  const variant = matchingVariant(group, selections);
  if (!variant) return product;
  return { ...product,
    ...(variant.images.length ? { imageUrl: variant.images[0]!, attributes: { ...product.attributes, images: variant.images } } : {}),
    offers: product.offers.map(offer => offer.isActive && offer.merchant?.code === 'ebay' ? {
      ...offer, externalProductId: variant.externalProductId, priceAmount: variant.priceAmount,
      currencyCode: variant.currencyCode, destinationUrl: variant.destinationUrl,
      availability: variant.availability, shippingInfo: variant.shippingInfo,
    } : offer),
  };
}
