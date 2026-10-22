import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../src/i18n/I18nContext';
import { ProductDetailContent } from '../src/components/ProductDetailContent';
import { OfferShipping } from '../src/components/OfferShipping';
import { shippingFacts } from '../src/lib/shipping-presentation';
import type { ProductWithOffers, Market } from '../src/types';

const market = { code: 'GE' } as Market;
function product(code = 'ebay'): ProductWithOffers {
  return { id: 'synthetic', slug: 'synthetic', name: 'Sony headphones', brand: 'Sony', model: 'WH-1000XM5',
    description: 'Wireless headphones.', categoryId: null, imageUrl: null, attributes: { condition: 'Open box', color: 'Black', material: 'Aluminium', sourceIdentity: 'private-id' },
    isActive: true, createdAt: '', updatedAt: '', offers: [{ id: 'offer', productId: 'synthetic', merchantId: code, marketId: 'ge',
      externalProductId: 'listing', priceAmount: 5300, currencyCode: 'USD', availability: 'unknown', shippingInfo: {},
      destinationUrl: 'https://merchant.example.test/tracked?synthetic=1', affiliateMetadata: {}, lastCheckedAt: '', isActive: true, createdAt: '', updatedAt: '',
      merchant: { id: code, code, name: code === 'ebay' ? 'eBay' : 'AliExpress', logoUrl: null } }] };
}
const render = (view: React.ReactNode) => renderToStaticMarkup(<I18nProvider>{view}</I18nProvider>);

test('single offer has one purchase CTA and no redundant comparison; useful facts only', () => {
  const item = product(); const html = render(<ProductDetailContent product={item} market={market} />);
  assert.equal((html.match(/Buy on eBay/g) || []).length, 1);
  for (const value of ['Sony','WH-1000XM5','Open box','Black','Aluminium','$53.00','About this product']) assert.ok(html.includes(value), value);
  for (const value of ['id="product-offers"','<table','private-id','Unknown','Estimated delivery','Best Price']) assert.ok(!html.includes(value), value);
});
test('multiple eligible offers compare below main purchase area without cross-currency claims', () => {
  const item = product(); item.offers.push({ ...item.offers[0], id: 'two', currencyCode: 'EUR', priceAmount: 6000 });
  const html = render(<ProductDetailContent product={item} market={market} />);
  assert.ok(html.includes('id="product-offers"')); assert.ok(html.includes('Compare 2 offers'));
  assert.ok(html.includes('$53.00')); assert.ok(html.includes('€60.00')); assert.ok(!html.includes('Best Price'));
  item.offers[1].isActive = false;
  assert.ok(!render(<ProductDetailContent product={item} market={market} />).includes('id="product-offers"'));
});
test('unknown facts and nested attributes stay hidden', () => {
  const item = product(); item.brand = 'Unknown'; item.model = 'N/A'; item.attributes = { color: 'unknown', conditionId: 'private-id', seller: { raw: 'private' } };
  const html = render(<ProductDetailContent product={item} market={market} />);
  for (const text of ['Unknown','N/A','private-id','[object Object]']) assert.ok(!html.includes(text));
  item.category = { id: 'internal', slug: 'aliexpress-feed', name: 'AliExpress feed' } as ProductWithOffers['category'];
  assert.ok(!render(<ProductDetailContent product={item} market={market} />).includes('AliExpress feed'));
});
test('exact shipping cost, service and source delivery dates render with explicit destination', () => {
  const offer = product().offers[0];
  offer.shippingInfo = { options: [{ shippingCost: { amount: 895, currencyCode: 'USD' }, type: 'Standard Shipping', shippingServiceCode: 'USPS',
    minEstimatedDeliveryDate: '2030-10-28T00:00:00Z', maxEstimatedDeliveryDate: '2030-11-04T00:00:00Z', shipToLocationUsedForEstimate: { country: 'US' } }] };
  const html = render(<OfferShipping offer={offer} />);
  for (const value of ['$8.95','USPS','Oct 28','Nov 4','United States']) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('Georgia'));
  (offer.shippingInfo.options as Record<string, unknown>[])[0].shippingCost = { amount: 0, currencyCode: 'USD' };
  assert.ok(render(<OfferShipping offer={offer} />).includes('Free shipping'));
});
test('one-sided ETA, missing ETA, stale/malformed ETA and destination ambiguity are handled honestly', () => {
  const offer = product().offers[0];
  offer.shippingInfo = { options: [{ maxEstimatedDeliveryDate: '2030-11-04T00:00:00Z' }] };
  let html = render(<OfferShipping offer={offer} />);
  assert.ok(html.includes('By Nov 4')); assert.ok(html.includes('Destination not confirmed'));
  for (const options of [[{}], [{ maxEstimatedDeliveryDate: 'bad' }], [{ maxEstimatedDeliveryDate: '2000-01-01T00:00:00Z' }],
    [{ minEstimatedDeliveryDate: '2030-11-05T00:00:00Z', maxEstimatedDeliveryDate: '2030-11-04T00:00:00Z' }]]) {
    offer.shippingInfo = { options }; html = render(<OfferShipping offer={offer} />);
    assert.ok(!html.includes('Estimated delivery'));
  }
  offer.shippingInfo = { freeShipping: true, estimatedDays: '3-5' };
  assert.equal(render(<OfferShipping offer={offer} />), '');
});
test('AliExpress gating remains fail-closed and cannot inherit unsupported shipping data', () => {
  const previous = process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED;
  process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED = 'false';
  try {
    const item = product('aliexpress'); item.offers[0].shippingInfo = { options: [{ shippingCost: { amount: 0, currencyCode: 'USD' } }] };
    const html = render(<ProductDetailContent product={item} market={market} />);
    assert.ok(html.includes('AliExpress')); assert.ok(html.includes('$53.00')); assert.ok(html.includes('aria-disabled="true"'));
    assert.ok(!html.includes('href="https://merchant.example.test')); assert.equal(shippingFacts(item.offers[0]), undefined);
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED; else process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED = previous; }
});
