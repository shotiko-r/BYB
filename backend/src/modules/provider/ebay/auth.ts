import { z } from 'zod';
import { EBAY_URLS, type EbayConfig } from './config.js';
import { ebayJson, EbayError } from './http.js';

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().int().positive() });
export class EbayTokenManager {
  private cached?: { value: string; expires: number };
  private pending?: Promise<string>;
  constructor(private readonly config: EbayConfig, private readonly transport: typeof fetch = fetch,
    private readonly now: () => number = Date.now, private readonly timeoutMs = 5000) {}
  invalidate(value: string): void { if (this.cached?.value === value) this.cached = undefined; }
  async getToken(): Promise<string> {
    if (this.cached && this.cached.expires > this.now()) return this.cached.value;
    if (!this.pending) {
      this.pending = (async () => {
        const body = new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' });
        const result = tokenSchema.safeParse(await ebayJson(this.transport, EBAY_URLS[this.config.environment].oauth, {
          method: 'POST', body: body.toString(), headers: {
            Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }, this.timeoutMs));
        if (!result.success) throw new EbayError('malformed');
        const { access_token, expires_in } = result.data;
        this.cached = { value: access_token, expires: this.now() + (expires_in - Math.min(30, expires_in / 10)) * 1000 };
        return access_token;
      })();
    }
    const pending = this.pending;
    try { return await pending; } finally { if (this.pending === pending) this.pending = undefined; }
  }
}
