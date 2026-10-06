import type { ConciergeResponse, ProductWithOffers } from '@byb/shared/types';
import { z } from 'zod';

const databaseDatetimeSchema = z.string().datetime({ offset: true });

function isoDatetime(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  // json_agg encodes PostgreSQL timestamps as offset strings, unlike top-level
  // columns decoded by pg into Dates. The public schema requires UTC Z strings.
  if (/[+-]\d{2}:\d{2}$/.test(value) && databaseDatetimeSchema.safeParse(value).success) {
    return new Date(value).toISOString();
  }
  return value;
}

// PostgreSQL timestamp columns can arrive as Date instances despite repository
// type annotations. Convert only the public contract's timestamp fields, before
// response validation; leave attributes and other arbitrary metadata untouched.
function serializeProduct(product: ProductWithOffers): ProductWithOffers {
  return {
    ...product,
    createdAt: isoDatetime(product.createdAt),
    updatedAt: isoDatetime(product.updatedAt),
    category: product.category && {
      ...product.category,
      createdAt: isoDatetime(product.category.createdAt),
      updatedAt: isoDatetime(product.category.updatedAt),
    },
    merchant: product.merchant && {
      ...product.merchant,
      createdAt: isoDatetime(product.merchant.createdAt),
      updatedAt: isoDatetime(product.merchant.updatedAt),
    },
    offers: product.offers.map(offer => ({
      ...offer,
      createdAt: isoDatetime(offer.createdAt),
      updatedAt: isoDatetime(offer.updatedAt),
      lastCheckedAt: isoDatetime(offer.lastCheckedAt),
    })),
  };
}

export function serializeConciergeResponse(response: ConciergeResponse): ConciergeResponse {
  if (response.status !== 'recommendations') return response;
  return {
    ...response,
    recommendations: response.recommendations.map(recommendation => ({
      ...recommendation,
      product: serializeProduct(recommendation.product),
    })),
  };
}
