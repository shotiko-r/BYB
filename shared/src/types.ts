import { z } from 'zod';
import { SearchCurrencySchema } from './money';

export const MarketSchema = z.object({
  id: z.string().uuid(),
  code: z.string().length(2),
  name: z.string(),
  locale: z.string(),
  language: z.string(),
  currencyCode: z.string().length(3),
  currencySymbol: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Market = z.infer<typeof MarketSchema>;

export const CategorySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  parentId: z.string().uuid().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Category = z.infer<typeof CategorySchema>;

export const MerchantSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  logoUrl: z.string().url().nullable(),
  websiteUrl: z.string().url().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Merchant = z.infer<typeof MerchantSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  imageUrl: z.string().url().nullable(),
  attributes: z.record(z.unknown()),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Product = z.infer<typeof ProductSchema>;

export const OfferSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  merchantId: z.string().uuid(),
  merchant: z.object({
    id: z.string().uuid(), code: z.string(), name: z.string(), logoUrl: z.string().nullable(),
  }).optional(),
  marketId: z.string().uuid(),
  externalProductId: z.string(),
  priceAmount: z.number().int().nonnegative(),
  currencyCode: z.string().length(3),
  availability: z.enum(['in_stock', 'out_of_stock', 'limited', 'pre_order', 'unknown']),
  shippingInfo: z.record(z.unknown()),
  destinationUrl: z.string().url(),
  affiliateMetadata: z.record(z.unknown()),
  lastCheckedAt: z.string().datetime(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Offer = z.infer<typeof OfferSchema>;

export const SearchIntentSchema = z.object({
  // Budgets are integer minor units in this currency; no FX conversion.
  currencyCode: z.string().regex(/^[A-Z]{3}$/).optional(),
  category: z.string().optional(),
  maxPrice: z.number().positive().optional(),
  minPrice: z.number().nonnegative().optional(),
  brand: z.string().optional(),
  query: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
});

export type SearchIntent = z.infer<typeof SearchIntentSchema>;

export const SearchQuerySchema = z.object({
  currencyCode: SearchCurrencySchema.optional(),
  currency: SearchCurrencySchema.optional(),
  merchant: z.union([z.string(), z.array(z.string())]).transform(value =>
    [...new Set((Array.isArray(value) ? value : [value]).flatMap(part => part.split(',')).map(code => code.trim()).filter(Boolean))].sort()
  ).pipe(z.array(z.string().regex(/^[a-z0-9][a-z0-9_-]{0,49}$/)).min(1).max(20)).optional(),
  q: z.string().trim().min(1).max(500),
  market: z.string().length(2).optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().int().nonnegative().max(2147483647).optional(),
  maxPrice: z.coerce.number().int().positive().max(2147483647).optional(),
  brand: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['relevance', 'best_match', 'price_asc', 'price_desc', 'newest']).default('relevance'),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export const SearchOptionsSchema = z.object({
  merchants: z.array(z.object({ code: z.string(), name: z.string() })),
  categories: z.array(z.object({ id: z.string().uuid(), slug: z.string(), name: z.string(), parentId: z.string().uuid().nullable() })),
  currencies: z.array(SearchCurrencySchema),
});
export type SearchOptions = z.infer<typeof SearchOptionsSchema>;

export const ProductWithOffersSchema = ProductSchema.extend({
  offers: z.array(OfferSchema),
  merchant: MerchantSchema.optional(),
  category: CategorySchema.optional(),
});

export type ProductWithOffers = z.infer<typeof ProductWithOffersSchema>;

export const DISCOVERY_SECTION_KEYS = ['discover', 'new_on_byb', 'under_25_usd', 'under_50_usd', 'more_to_explore'] as const;
export const DiscoverySectionKeySchema = z.enum(DISCOVERY_SECTION_KEYS);
export type DiscoverySectionKey = z.infer<typeof DiscoverySectionKeySchema>;
// Explicit public card shape: no source attributes, feed metadata or shipping guesses.
export const DiscoveryProductSchema = ProductWithOffersSchema.extend({
  offerCount: z.number().int().nonnegative(),
  distinctMerchantCount: z.number().int().nonnegative(),
  firstSeenAt: z.string().datetime(),
});
export type DiscoveryProduct = z.infer<typeof DiscoveryProductSchema>;
export const DiscoverySectionSchema = z.object({
  key: DiscoverySectionKeySchema,
  titleKey: z.string(),
  status: z.enum(['ok', 'unavailable']),
  products: z.array(DiscoveryProductSchema),
});
export type DiscoverySection = z.infer<typeof DiscoverySectionSchema>;
export const DiscoveryHomeSchema = z.object({
  market: z.string().length(2),
  generatedAt: z.string().datetime(),
  rotationBucket: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  algorithmVersion: z.string(),
  sections: z.array(DiscoverySectionSchema),
});
export type DiscoveryHome = z.infer<typeof DiscoveryHomeSchema>;
export const DiscoveryQuerySchema = z.object({
  market: z.string().regex(/^[a-zA-Z]{2}$/).transform(value => value.toUpperCase()).default('GE'),
  section: DiscoverySectionKeySchema.default('discover'),
  limit: z.coerce.number().int().min(1).max(20).default(4),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
}).strict();

export const SearchResultSchema = z.object({
  products: z.array(ProductWithOffersSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  query: SearchQuerySchema,
  intent: SearchIntentSchema.optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const ProviderProductSchema = z.object({
  externalId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  attributes: z.record(z.unknown()).optional(),
  priceAmount: z.number().int().nonnegative(),
  currencyCode: z.string().length(3),
  availability: z.enum(['in_stock', 'out_of_stock', 'limited', 'pre_order', 'unknown']).optional(),
  shippingInfo: z.record(z.unknown()).optional(),
  destinationUrl: z.string().url(),
  affiliateMetadata: z.record(z.unknown()).optional(),
});

export type ProviderProduct = z.infer<typeof ProviderProductSchema>;

export const ProviderSearchResultSchema = z.object({
  products: z.array(ProviderProductSchema),
  total: z.number().int().nonnegative(),
  query: z.string(),
});

export type ProviderSearchResult = z.infer<typeof ProviderSearchResultSchema>;

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  timestamp: z.string().datetime(),
  version: z.string(),
  database: z.enum(['connected', 'disconnected']),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const MarketListResponseSchema = z.array(MarketSchema);
export type MarketListResponse = z.infer<typeof MarketListResponseSchema>;

export const MerchantListResponseSchema = z.array(MerchantSchema);
export type MerchantListResponse = z.infer<typeof MerchantListResponseSchema>;

export const CategoryListResponseSchema = z.array(CategorySchema);
export type CategoryListResponse = z.infer<typeof CategoryListResponseSchema>;
// Concierge budgets use integer minor units, with no currency conversion.
const ConciergeTextSchema = z.string().trim().min(1).max(100);
export const ConciergeBudgetSchema = z.union([
  z.object({
    minPrice: z.number().int().nonnegative().optional(),
    maxPrice: z.number().int().positive().optional(),
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
  }).strict().refine(b => b.minPrice !== undefined || b.maxPrice !== undefined, 'Specify a budget bound')
    .refine(b => b.minPrice === undefined || b.maxPrice === undefined || b.minPrice <= b.maxPrice, 'Invalid budget range'),
  z.object({ unlimited: z.literal(true) }).strict(),
]);
export const ConciergeAnswersSchema = z.object({
  category: ConciergeTextSchema.optional(),
  useCase: ConciergeTextSchema.optional(),
  budget: ConciergeBudgetSchema.optional(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).optional(),
  // An empty list explicitly means no feature preference.
  features: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  brand: ConciergeTextSchema.optional(),
}).strict();
export const ConciergeRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  market: z.string().regex(/^[A-Za-z]{2}$/).transform(s => s.toUpperCase()).default('GE'),
  answers: ConciergeAnswersSchema.optional(),
}).strict();
export type ConciergeRequest = z.infer<typeof ConciergeRequestSchema>;
export const ConciergeIntentSchema = SearchIntentSchema.extend({
  minPrice: z.number().int().nonnegative().optional(),
  maxPrice: z.number().int().positive().optional(),
  filters: z.object({
    useCase: ConciergeTextSchema.optional(),
    features: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    budgetUnrestricted: z.boolean().optional(),
  }).passthrough().optional(),
}).refine(i => i.minPrice === undefined || i.maxPrice === undefined || i.minPrice <= i.maxPrice, 'Invalid budget range');
export const ConciergeQuestionSchema = z.object({
  id: z.enum(['category', 'useCase', 'budget', 'currencyCode', 'features']),
  prompt: z.string(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});
export type ConciergeQuestion = z.infer<typeof ConciergeQuestionSchema>;
export const ConciergeRecommendationSchema = z.object({
  matchScore: z.number().int().min(0).max(100),
  reasons: z.array(z.string()),
  product: ProductWithOffersSchema,
});
export type ConciergeRecommendation = z.infer<typeof ConciergeRecommendationSchema>;
export const ConciergeResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('needs_clarification'), questions: z.array(ConciergeQuestionSchema).min(1).max(4) }),
  z.object({ status: z.literal('recommendations'), intent: ConciergeIntentSchema, recommendations: z.array(ConciergeRecommendationSchema) }),
]);
export type ConciergeResponse = z.infer<typeof ConciergeResponseSchema>;
