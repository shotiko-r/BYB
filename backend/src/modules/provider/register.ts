import type { ProviderRegistry } from './types.js';
import { AmazonProvider, TemuProvider, AliExpressProvider, EbayProvider as MockEbayProvider } from './mock/index.js';
import { EbayProvider } from './ebay/ebay-provider.js';
import { EbayTokenManager } from './ebay/auth.js';
import { EbayBrowseClient } from './ebay/client.js';

export function registerProviders(registry: ProviderRegistry, settings: {
  EBAY_PROVIDER_MODE?: 'mock' | 'real'; EBAY_ENVIRONMENT?: 'production' | 'sandbox';
  EBAY_CLIENT_ID?: string; EBAY_CLIENT_SECRET?: string;
} = {}, transport: typeof fetch = fetch): void {
  let ebay: MockEbayProvider | EbayProvider = new MockEbayProvider();
  if (settings.EBAY_PROVIDER_MODE === 'real') {
    if (!settings.EBAY_CLIENT_ID?.trim() || !settings.EBAY_CLIENT_SECRET?.trim()) throw new Error('Real eBay mode requires backend client credentials');
    const config = { environment: settings.EBAY_ENVIRONMENT ?? 'production', clientId: settings.EBAY_CLIENT_ID, clientSecret: settings.EBAY_CLIENT_SECRET };
    ebay = new EbayProvider(new EbayBrowseClient(config, new EbayTokenManager(config, transport), transport), config.environment);
  }
  for (const provider of [new AmazonProvider(), new TemuProvider(), new AliExpressProvider(), ebay]) {
    if (!('provenance' in provider)) Object.defineProperty(provider, 'provenance', { value: {
      version: 1, provider: provider.code, mode: 'mock', environment: 'mock',
    } });
    registry.register(provider);
  }
}
