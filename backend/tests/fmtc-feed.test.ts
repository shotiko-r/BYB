import { describe, expect, it, vi } from 'vitest';
import { fetchFmtcPage, loadFmtcConfig, mapFmtcProduct } from '../src/modules/feed/fmtc.js';
import { mapAliExpressRow } from '../src/modules/feed/merchants/aliexpress.js';
import { parseFeedMoney } from '../src/modules/feed/money.js';

export const fixture = { product_id: '123', merchant_id: 62058, network_id: 2, label: 'Synthetic headphones',
  price: 12.34, sale_price: 10.05, currency_code: 'USD', affiliate_url: 'https://example.com/affiliate',
  image_link: 'https://example.com/image.jpg', raw_brand_name: 'Brand', description: 'Description', gtin: '12345678', additional_details: { sku: 'SKU' } };

describe('FMTC feed', () => {
  it('validates config without exposing secrets', () => {
    for (const token of ['', 'a b', 'a\nb']) expect(() => loadFmtcConfig({ FMTC_API_TOKEN: token })).toThrow('CONFIG');
    expect(loadFmtcConfig({ FMTC_API_TOKEN: 'secret' }).token).toBe('secret');
  });
  it('maps fields and keeps shipping unknown', () => {
    expect(mapFmtcProduct(fixture)).toMatchObject({ name: fixture.label, brand: 'Brand', description: 'Description', externalProductId: '123',
      priceAmount: 1005, currencyCode: 'USD', destinationUrl: fixture.affiliate_url, imageUrl: fixture.image_link,
      attributes: { gtin: '12345678', sku: 'SKU' }, shippingInfo: { shipping: 'unknown', tax: 'unknown' },
      affiliateMetadata: { oldPriceAmount: 1234, oldPriceCurrencyCode: 'USD' } });
  });
  it('uses a sale price only when positive and below the positive regular price', () => {
    expect(mapFmtcProduct({ ...fixture, sale_price: 10 }).priceAmount).toBe(1000);
    expect(mapFmtcProduct({ ...fixture, sale_price: 20 }).priceAmount).toBe(1234);
    expect(mapFmtcProduct({ ...fixture, sale_price: 0 }).priceAmount).toBe(1234);
    expect(mapFmtcProduct({ ...fixture, price: 0, sale_price: 10 }).priceAmount).toBe(0);
    expect(mapFmtcProduct({ ...fixture, sale_price: 'invalid' }).priceAmount).toBe(1234);
    expect(mapFmtcProduct({ ...fixture, sale_price: 20 }).affiliateMetadata).not.toHaveProperty('oldPriceAmount');
    expect(mapFmtcProduct({ ...fixture, sale_price: 12.34 }).priceAmount).toBe(1234);
    expect(mapFmtcProduct({ ...fixture, sale_price: 12.34 }).affiliateMetadata).not.toHaveProperty('oldPriceAmount');
  });
  it('converts decimal money exactly and rejects excess precision or overflow', () => {
    expect(parseFeedMoney('0.29', 'USD')).toBe(29); expect(parseFeedMoney('12.3', 'USD')).toBe(1230);
    for (const value of ['0.001', '-1', '21474836.48']) expect(() => parseFeedMoney(value, 'USD')).toThrow();
  });
  it('separates the same external ID from Admitad', () => {
    const admitad = mapAliExpressRow({ id: '123', name: 'Synthetic', url: 'https://example.com/a', category: '', currencyId: 'USD', param: '', picture: 'https://example.com/i', oldprice: '', price: '1' }, { programNamespace: 'aliexpress-ww' });
    expect(admitad.ok).toBe(true); if (admitad.ok) expect(admitad.value.sourceIdentity).not.toBe(mapFmtcProduct(fixture).sourceIdentity);
  });
  it('makes one bounded request and validates the response and merchant', async () => {
    const transport = vi.fn(async () => new Response(JSON.stringify({ data: [fixture], links: { next: 'https://example.com/next' } })));
    expect(await fetchFmtcPage({ token: 'secret' }, transport as typeof fetch)).toHaveLength(1);
    expect(transport).toHaveBeenCalledTimes(1);
    const url = transport.mock.calls[0]?.[0] as unknown as URL;
    expect(url.searchParams.get('page_size')).toBe('10'); expect(url.searchParams.get('merchant_ids')).toBe('62058');
    for (const data of [{ nope: [] }, { data: Array(11).fill(fixture) }, { data: [{ ...fixture, merchant_id: 1 }] }]) {
      await expect(fetchFmtcPage({ token: 'secret' }, (async () => new Response(JSON.stringify(data))) as typeof fetch)).rejects.toThrow('FMTC import failed');
    }
  });
});
