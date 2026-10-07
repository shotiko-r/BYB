import { beforeEach, describe, expect, it, vi } from 'vitest';
const { db } = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock('../src/config/database.js', () => ({ query: db }));
import { PostgresProductRepository } from '../src/modules/product/repository.js';
import { providerRegistry } from '../src/modules/provider/registry.js';
import { registerProviders } from '../src/modules/provider/register.js';
registerProviders(providerRegistry, { EBAY_PROVIDER_MODE: 'real', EBAY_CLIENT_ID: 'fixture', EBAY_CLIENT_SECRET: 'fixture' });
const repository = new PostgresProductRepository();
const real = { version: 1, provider: 'ebay', mode: 'real', environment: 'production' };
const row = { id: 'product', slug: 'target', name: 'Target', description: null, brand: null, model: null,
  category_id: null, image_url: null, attributes: {}, is_active: true,
  created_at: new Date(), updated_at: new Date() };
beforeEach(() => db.mockReset());
describe('product-detail offer eligibility', () => {
  it('hides an unknown/mock-only product through the same real-source SQL policy', async () => {
    db.mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rows: [] });
    expect(await repository.findByIdWithOffers('product', 'market')).toBeNull();
    expect(db.mock.calls[1]![0]).toContain("o.affiliate_metadata #> '{_byb,provenance}' = $4::jsonb");
    expect(db.mock.calls[1]![1]).toEqual(['product', 'market', 'ebay', JSON.stringify(real)]);
  });
  it('retains a shared product and its eligible real offer', async () => {
    db.mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rows: [{ id: 'real-offer', product_id: 'product',
      merchant_id: 'ebay', merchant_code: 'ebay', merchant_name: 'eBay', market_id: 'market', external_product_id: 'listing',
      price_amount: 15999, currency_code: 'USD', availability: 'unknown', shipping_info: {},
      destination_url: 'https://www.ebay.com/itm/123', affiliate_metadata: { _byb: { provenance: real } },
      last_checked_at: new Date(), created_at: new Date(), updated_at: new Date(), is_active: true }] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await repository.findByIdWithOffers('product', 'market');
    expect(result!.id).toBe('product');
    expect(result!.offers.map(offer => offer.id)).toEqual(['real-offer']);
  });
});
