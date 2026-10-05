import type { ProductProvider, ProviderRegistry } from './types.js';

export class InMemoryProviderRegistry implements ProviderRegistry {
  private providers = new Map<string, ProductProvider>();

  register(provider: ProductProvider): void {
    if (this.providers.has(provider.code)) {
      throw new Error(`Provider with code ${provider.code} already registered`);
    }
    this.providers.set(provider.code, provider);
  }

  get(code: string): ProductProvider | undefined {
    return this.providers.get(code);
  }

  getAll(): ProductProvider[] {
    return Array.from(this.providers.values());
  }

  getForMarket(marketCode: string): ProductProvider[] {
    return this.getAll().filter((p) => p.supportedMarkets.includes(marketCode));
  }
}

export const providerRegistry = new InMemoryProviderRegistry();