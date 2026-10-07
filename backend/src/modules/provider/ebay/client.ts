import type { EbayTokenManager } from './auth.js';
import { EBAY_URLS, type EbayConfig } from './config.js';
import { EbayError, ebayJson } from './http.js';

export class EbayBrowseClient {
  constructor(private readonly config: EbayConfig, private readonly tokens: EbayTokenManager,
    private readonly transport: typeof fetch = fetch, private readonly timeoutMs = 5000) {}
  async get(path: string, marketplace: string, params: Record<string, string> = {}): Promise<unknown> {
    const url = `${EBAY_URLS[this.config.environment].browse}${path}?${new URLSearchParams(params).toString()}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.tokens.getToken();
      try {
        return await ebayJson(this.transport, url, { headers: {
          Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace,
        } }, this.timeoutMs);
      } catch (error) {
        if (attempt === 0 && error instanceof EbayError && error.status === 401) {
          this.tokens.invalidate(token); continue;
        }
        throw error;
      }
    }
    throw new EbayError('auth');
  }
}
