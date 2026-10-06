import { SearchIntentSchema, SearchQuerySchema, type SearchQuery, type SearchResult } from '@byb/shared/types';
import type { ProviderRegistry, SearchIntent } from '../provider/types.js';
import type { SearchIntentParser } from '../ai/types.js';
import { ProductNormalizationService } from '../product/normalization.js';
import { PostgresProductRepository } from '../product/repository.js';
import { PostgresMarketRepository } from '../market/repository.js';
import { PostgresMerchantRepository } from '../merchant/repository.js';
import { providerRegistry } from '../provider/registry.js';
import { MockSearchIntentParser } from '../ai/mock-parser.js';
import { AppError } from '../../shared/errors.js';

type SearchOptions = Partial<Omit<SearchQuery, 'q' | 'market'>>;

export class SearchService {
  private readonly normalizationService = new ProductNormalizationService();
  private readonly productRepository = new PostgresProductRepository();
  private readonly marketRepository = new PostgresMarketRepository();
  private readonly merchantRepository = new PostgresMerchantRepository();
  private readonly intentParser: SearchIntentParser;

  constructor(
    private readonly registry: ProviderRegistry = providerRegistry,
    intentParser?: SearchIntentParser
  ) {
    this.intentParser = intentParser || new MockSearchIntentParser();
  }

  async search(query: string, marketCode: string, options: SearchOptions = {}): Promise<SearchResult> {
    const intent = await this.intentParser.parse(query, marketCode);
    // Explicit request filters win, including a zero minimum price.
    return this.searchIntent({
      ...intent,
      category: options.category ?? intent.category,
      brand: options.brand ?? intent.brand,
      minPrice: options.minPrice ?? intent.minPrice,
      maxPrice: options.maxPrice ?? intent.maxPrice,
      currencyCode: options.currencyCode ?? intent.currencyCode,
      query,
    }, marketCode, options);
  }

  async searchIntent(input: SearchIntent, marketCode: string, options: SearchOptions = {}): Promise<SearchResult> {
    const parsed = SearchIntentSchema.safeParse(input);
    if (!parsed.success) throw AppError.badRequest('Invalid search intent');
    const intent = parsed.data;
    if (intent.minPrice !== undefined && intent.maxPrice !== undefined && intent.minPrice > intent.maxPrice) {
      throw AppError.badRequest('Minimum price must not exceed maximum price');
    }
    const features = intent.filters?.features;
    if (features !== undefined && (!Array.isArray(features) || !features.every(f => typeof f === 'string'))) {
      throw AppError.badRequest('Intent features must be an array of strings');
    }
    const market = await this.marketRepository.findByCode(marketCode);
    if (!market) throw AppError.notFound(`Market ${marketCode} not found`);

    const queryResult = SearchQuerySchema.safeParse({
      ...options,
      q: intent.query?.trim() || intent.category || intent.brand || 'products',
      market: market.code,
      category: intent.category,
      brand: intent.brand,
      minPrice: intent.minPrice,
      maxPrice: intent.maxPrice,
      currencyCode: intent.currencyCode ?? options.currencyCode,
    });
    if (!queryResult.success) throw AppError.badRequest('Invalid search options or intent');
    const publicQuery = queryResult.data;
    // Price filters/sorts always operate in one currency, never on mixed raw amounts.
    const needsCurrency = intent.minPrice !== undefined || intent.maxPrice !== undefined || publicQuery.sort.startsWith('price_');
    const currencyCode = publicQuery.currencyCode ?? (needsCurrency ? market.currencyCode : undefined);
    if (currencyCode) publicQuery.currencyCode = currencyCode;
    const category = intent.category ? await this.productRepository.resolveCategory(intent.category) : undefined;
    const hasConstraints = Boolean(intent.category || intent.brand || (features as string[] | undefined)?.length || intent.filters?.useCase)
      || intent.minPrice !== undefined || intent.maxPrice !== undefined;
    const searchIntent: SearchIntent = {
      ...intent,
      category: category?.slug ?? intent.category,
      currencyCode,
      // Structured constraints drive retrieval; the original sentence remains in the public intent.
      query: hasConstraints ? undefined : intent.query?.trim(),
    };
    const providers = this.registry.getForMarket(market.code);
    if (!providers.length) throw AppError.unavailable(`No providers available for market ${market.code}`);
    const merchants = await this.merchantRepository.findAll();
    const merchantMap = new Map(merchants.filter(m => m.isActive).map(m => [m.code, m.id]));
    const outcomes = await Promise.allSettled(providers.map(async provider => {
      const merchantId = merchantMap.get(provider.code);
      // Never persist an offer with an empty/invalid merchant identity.
      if (!merchantId) return null;
      const result = await provider.search(searchIntent, market.code);
      return {
        merchantId,
        products: result.products.filter(product =>
          (!currencyCode || product.currencyCode === currencyCode) &&
          (intent.minPrice === undefined || product.priceAmount >= intent.minPrice) &&
          (intent.maxPrice === undefined || product.priceAmount <= intent.maxPrice)
        ),
      };
    }));
    const successful = outcomes.flatMap(outcome => outcome.status === 'fulfilled' && outcome.value ? [outcome.value] : []);
    if (!successful.length) throw AppError.unavailable('No configured providers completed the search');
    const normalized = await this.normalizationService.normalize(successful, market.id);
    await this.normalizationService.persist(normalized);
    const result = await this.productRepository.search({
      marketId: market.id,
      query: searchIntent.query,
      categoryId: category?.id,
      categorySlug: category ? undefined : intent.category,
      brand: intent.brand,
      minPrice: intent.minPrice,
      maxPrice: intent.maxPrice,
      currencyCode,
      features: features as string[] | undefined,
      page: publicQuery.page,
      limit: publicQuery.limit,
      sort: publicQuery.sort,
    });
    return {
      ...result,
      page: publicQuery.page,
      limit: publicQuery.limit,
      totalPages: Math.ceil(result.total / publicQuery.limit),
      query: publicQuery,
      intent: { ...intent, currencyCode },
    };
  }

  async getProduct(productId: string, marketCode: string) {
    const market = await this.marketRepository.findByCode(marketCode);
    if (!market) throw AppError.notFound(`Market ${marketCode} not found`);
    return this.productRepository.findByIdWithOffers(productId, market.id);
  }
}
