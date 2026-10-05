import type { ProviderRegistry, SearchIntent } from '../provider/types.js';
import type { SearchIntentParser } from '../ai/types.js';
import { ProductNormalizationService } from '../product/normalization.js';
import { PostgresProductRepository } from '../product/repository.js';
import { PostgresMarketRepository } from '../market/repository.js';
import { PostgresMerchantRepository } from '../merchant/repository.js';
import { providerRegistry } from '../provider/registry.js';
import { MockSearchIntentParser } from '../ai/mock-parser.js';
import { AppError } from '../../shared/errors.js';

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

  async search(query: string, marketCode: string, filters?: {
    category?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
    sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  }) {
    const market = await this.marketRepository.findByCode(marketCode);
    if (!market) {
      throw AppError.notFound(`Market ${marketCode} not found`);
    }

    const intent = await this.intentParser.parse(query, marketCode);

    const searchIntent: SearchIntent = {
      ...intent,
      category: filters?.category || intent.category,
      brand: filters?.brand || intent.brand,
      maxPrice: filters?.maxPrice || intent.maxPrice,
      minPrice: filters?.minPrice || intent.minPrice,
      query,
    };

    const providers = this.registry.getForMarket(marketCode);
    if (providers.length === 0) {
      throw AppError.unavailable(`No providers available for market ${marketCode}`);
    }

    const merchants = await this.merchantRepository.findAll();
    const merchantMap = new Map(merchants.map((m) => [m.code, m.id]));

    const providerResults = await Promise.all(
      providers.map(async (provider) => {
        const result = await provider.search(searchIntent, marketCode);
        const merchantId = merchantMap.get(provider.code) || '';
        return { products: result.products, merchantId };
      })
    );

    const normalized = await this.normalizationService.normalize(
      providerResults,
      market.id
    );

    await this.normalizationService.persist(normalized);

    const searchFilters = {
      marketId: market.id,
      query,
      categoryId: filters?.category,
      brand: filters?.brand,
      minPrice: filters?.minPrice,
      maxPrice: filters?.maxPrice,
      page: filters?.page || 1,
      limit: filters?.limit || 20,
      sort: filters?.sort || 'relevance',
    };

    const result = await this.productRepository.search(searchFilters);

    return {
      products: result.products,
      total: result.total,
      page: searchFilters.page,
      limit: searchFilters.limit,
      totalPages: Math.ceil(result.total / searchFilters.limit),
      query: searchFilters,
      intent: searchIntent,
    };
  }

  async getProduct(productId: string, marketCode: string) {
    const market = await this.marketRepository.findByCode(marketCode);
    if (!market) {
      throw AppError.notFound(`Market ${marketCode} not found`);
    }

    return this.productRepository.findByIdWithOffers(productId, market.id);
  }
}