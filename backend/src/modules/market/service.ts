import type { MarketRepository } from './repository.js';
import type { Market } from '@byb/shared/types';
import { AppError } from '../../shared/errors.js';

export class MarketService {
  constructor(private readonly repository: MarketRepository) {}

  async getAllMarkets(): Promise<Market[]> {
    return this.repository.findAll();
  }

  async getMarketByCode(code: string): Promise<Market> {
    const market = await this.repository.findByCode(code);
    if (!market) {
      throw AppError.notFound(`Market with code ${code} not found`);
    }
    return market;
  }

  async getActiveMarkets(): Promise<Market[]> {
    return this.repository.findActive();
  }

  async validateMarket(code: string): Promise<Market> {
    const market = await this.getMarketByCode(code);
    if (!market.isActive) {
      throw AppError.badRequest(`Market ${code} is not active`);
    }
    return market;
  }
}