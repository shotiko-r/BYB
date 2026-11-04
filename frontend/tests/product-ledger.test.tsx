import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../src/i18n/I18nContext';
import { ProductOfferLedger } from '../src/components/ProductOfferLedger';
import { ProductOfferSummary } from '../src/components/ProductOfferSummary';
import { compareAtPrice, priceSaving } from '../src/lib/offer-prices';
import { formatCheckedAt, ledgerRows, lowestKnownTotal } from '../src/lib/ledger-preview';
import { offerSourceKey } from '../src/lib/product-presentation';
import type { Market, Offer, ProductWithOffers } from '../src/types';

const market = { code: 'GE' } as Market;
const render = (view: React.ReactNode) => renderToStaticMarkup(<I18nProvider>{view}</I18nProvider>);

function makeOffer(id: string, overrides: Partial<Offer> = {}): Offer {
  return {
    id, productId: 'product', merchantId: 'ebay', marketId: 'ge', externalProductId: id,
    priceAmount: 10000, currencyCode: 'USD', availability: 'in_stock', shippingInfo: {},
    destinationUrl: `https://merchant.example.test/${id}`, affiliateMetadata: {},
    lastCheckedAt: '2030-10-28T12:00:00Z', isActive: true, createdAt: '', updatedAt: '',
    merchant: { id: 'ebay', code: 'ebay', name: 'eBay', logoUrl: null },
    ...overrides,
  };
}

function makeProduct(offers: Offer[]): ProductWithOffers {
  return {
    id: 'product', slug: 'product', name: 'Synthetic product', description: null, brand: null,
    model: null, categoryId: null, imageUrl: null, attributes: {}, isActive: true,
    createdAt: '', updatedAt: '', offers,
  };
}

test('compare-at prices require an explicit larger integer in the offer currency', () => {
  const offer = makeOffer('main', { affiliateMetadata: { oldPriceAmount: 12000, oldPriceCurrencyCode: 'USD' } });
  assert.deepEqual(compareAtPrice(offer), { amount: 12000, currencyCode: 'USD' });
  for (const metadata of [
    { oldPriceAmount: 12000, oldPriceCurrencyCode: 'EUR' },
    { oldPriceAmount: 12000.5, oldPriceCurrencyCode: 'USD' },
    { oldPriceAmount: '12000', oldPriceCurrencyCode: 'USD' },
    { oldPriceAmount: 9000, oldPriceCurrencyCode: 'USD' },
    { oldPriceAmount: 10000, oldPriceCurrencyCode: 'USD' },
  ]) {
    assert.equal(compareAtPrice({ ...offer, affiliateMetadata: metadata }), undefined);
  }
  assert.deepEqual(priceSaving(10000, 12000), { amount: 2000, percent: 17 });
  assert.equal(priceSaving(12000, 10000), undefined);
});

test('lowest totals need every offer and one common currency', () => {
  const unknownShipping = makeOffer('a');
  const freeShipping = makeOffer('b', { shippingInfo: { options: [{ shippingCost: { amount: 0, currencyCode: 'USD' } }] } });
  const paidShipping = makeOffer('c', { priceAmount: 9000, shippingInfo: { options: [{ shippingCost: { amount: 500, currencyCode: 'USD' } }] } });
  const mixed = makeOffer('d', { currencyCode: 'EUR', shippingInfo: { options: [{ shippingCost: { amount: 500, currencyCode: 'EUR' } }] } });
  const mixedShipping = makeOffer('e', { shippingInfo: { options: [{ shippingCost: { amount: 500, currencyCode: 'EUR' } }] } });

  assert.equal(lowestKnownTotal(ledgerRows(makeProduct([unknownShipping, freeShipping]))), undefined);
  assert.deepEqual(lowestKnownTotal(ledgerRows(makeProduct([freeShipping, paidShipping]))), { amount: 9500, currencyCode: 'USD' });
  assert.equal(lowestKnownTotal(ledgerRows(makeProduct([freeShipping, paidShipping, mixed]))), undefined);
  assert.equal(ledgerRows(makeProduct([mixedShipping]))[0]?.total, undefined);
  assert.deepEqual(ledgerRows(makeProduct([paidShipping]))[0]?.total, { amount: 9500, currencyCode: 'USD' });
});

test('source labels expose feed provenance without provider internals', () => {
  assert.equal(offerSourceKey(makeOffer('ebay')), 'product.source.ebay');
  assert.equal(offerSourceKey(makeOffer('fmtc', { merchant: { id: 'ali', code: 'aliexpress', name: 'AliExpress', logoUrl: null }, affiliateMetadata: { _byb: { sourceType: 'fmtc-feed', remoteId: 'private' } } })), 'product.source.fmtc');
  assert.equal(offerSourceKey(makeOffer('admitad', { merchant: { id: 'ali', code: 'aliexpress', name: 'AliExpress', logoUrl: null }, affiliateMetadata: { _byb: { sourceType: 'admitad-feed' } } })), 'product.source.admitad');
  assert.equal(offerSourceKey(makeOffer('ali', { merchant: { id: 'ali', code: 'aliexpress', name: 'AliExpress', logoUrl: null } })), 'product.source.aliexpress');
  assert.equal(offerSourceKey(makeOffer('other', { merchant: { id: 'other', code: 'other', name: 'Other', logoUrl: null } })), 'product.source.merchant');
  assert.equal(formatCheckedAt('not-a-date', 'en-US'), undefined);
  assert.ok(formatCheckedAt('2030-10-28T12:00:00Z', 'en-US')?.includes('2030'));
});

test('ledger renders known totals, savings and labels while refusing mixed-currency ranking', () => {
  const discounted = makeOffer('discounted', {
    priceAmount: 9000,
    affiliateMetadata: { oldPriceAmount: 12000, oldPriceCurrencyCode: 'USD' },
    shippingInfo: { options: [{ shippingCost: { amount: 500, currencyCode: 'USD' } }] },
  });
  const complete = makeOffer('complete', { priceAmount: 10000, shippingInfo: { options: [{ shippingCost: { amount: 0, currencyCode: 'USD' } }] } });
  let html = render(<><ProductOfferSummary product={makeProduct([discounted, complete])} market={market.code} />
    <ProductOfferLedger product={makeProduct([discounted, complete])} market={market} /></>);
  assert.ok(html.includes('id="product-offers"'));
  assert.ok(html.includes('$90.00'));
  assert.ok(html.includes('$120.00'));
  assert.ok(html.includes('Save $30.00 (25%)'));
  assert.ok(html.includes('Source: eBay listing'));
  assert.ok(html.includes('Lowest known total'));
  assert.ok(html.includes('$95.00'));

  const mixed = makeOffer('mixed', { currencyCode: 'EUR', shippingInfo: { options: [{ shippingCost: { amount: 500, currencyCode: 'EUR' } }] } });
  html = render(<ProductOfferLedger product={makeProduct([discounted, complete, mixed])} market={market} />);
  assert.ok(html.includes('€105.00'));
  assert.ok(!html.includes('Lowest known total'));
  assert.ok(!html.includes('private'));
});
