import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { ExploreSection } from '../src/components/ExploreSection';
import { Hero } from '../src/components/Hero';
import { HomeCommitments } from '../src/components/HomeCommitments';
import { OfferLedgerPreview } from '../src/components/OfferLedgerPreview';
import { MerchantSources } from '../src/components/MerchantSources';
import { TrustSection } from '../src/components/TrustSection';
import { DiscoveryShelf, SHELF_INTERVAL_MS } from '../src/components/DiscoveryShelf';
import { I18nProvider } from '../src/i18n/I18nContext';
import { featuredCategories, homepageCategories, categorySearchHref } from '../src/lib/homepage-categories';
import { requestForState, searchState } from '../src/lib/search-presentation';
import { readInterests, rememberInterest, clearInterests } from '../src/lib/local-interests';
import type { ProductWithOffers } from '../src/types';

const render = (view: React.ReactNode) => renderToStaticMarkup(
  <AppRouterContext.Provider value={{ push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {}, bfcacheId: 'test' }}>
    <I18nProvider>{view}</I18nProvider>
  </AppRouterContext.Provider>);

test('eight curated categories exist and six editorial entries use real search URLs', () => {
  assert.equal(homepageCategories.length, 8);
  assert.equal(featuredCategories.length, 6);
  const html = render(<ExploreSection market="AM" />);
  assert.equal((html.match(/class="home-category category-tile/g) || []).length, 6);
  for (const category of featuredCategories) {
    const url = new URL(categorySearchHref(category.id, 'AM'), 'https://byb.example.test');
    assert.equal(url.pathname, '/search'); assert.equal(url.searchParams.get('market'), 'AM');
    assert.equal(url.searchParams.get('q'), category.query); assert.equal(url.searchParams.has('category'), false);
  }
  assert.ok(!html.includes('Coming soon'));
});

test('homepage hero leads with a dominant search form, popular terms and an offer ledger', () => {
  const market = { code: 'GE' } as Parameters<typeof Hero>[0]['market'];
  const html = render(<Hero market={market} />);
  assert.ok(html.includes('Compare the real offer, not the pitch.'));
  assert.ok(html.includes('<form')); assert.ok(html.includes('<input'));
  assert.ok(html.includes('Try a search'));
  assert.ok(html.includes('commission from qualifying purchases'));
  assert.ok(html.includes('Headphones')); assert.ok(html.includes('Coffee maker'));
  assert.ok(html.includes('Offer ledger is unavailable'));
  assert.ok(html.includes('/search?market=GE'));
  assert.ok(!html.includes('Ask BYB'));
});

test('offer ledger shows real prices, same-currency totals and honest missing shipping', () => {
  const stamp = '2026-10-21T12:00:00.000Z';
  const base = { productId: '00000000-0000-4000-8000-000000000001', marketId: '00000000-0000-4000-8000-000000000010',
    externalProductId: 'synthetic', availability: 'in_stock' as const, affiliateMetadata: {}, destinationUrl: 'https://merchant.example.test/item',
    lastCheckedAt: stamp, isActive: true, createdAt: stamp, updatedAt: stamp };
  const product = {
    id: base.productId, slug: 'synthetic', name: 'Synthetic travel headphones', description: null, brand: null, model: null,
    categoryId: null, imageUrl: null, attributes: {}, isActive: true, createdAt: stamp, updatedAt: stamp,
    offers: [
      { ...base, id: '00000000-0000-4000-8000-000000000002', merchantId: '00000000-0000-4000-8000-000000000003', merchant: { id: '00000000-0000-4000-8000-000000000003', code: 'ebay', name: 'eBay', logoUrl: null },
        priceAmount: 12999, currencyCode: 'USD', shippingInfo: { options: [{ type: 'shipping', shippingCost: { amount: 499, currencyCode: 'USD' }, shippingServiceCode: 'USPS Ground' }] } },
      { ...base, id: '00000000-0000-4000-8000-000000000004', merchantId: '00000000-0000-4000-8000-000000000005', merchant: { id: '00000000-0000-4000-8000-000000000005', code: 'aliexpress', name: 'AliExpress', logoUrl: null },
        priceAmount: 12499, currencyCode: 'USD', shippingInfo: {} },
    ],
  } as unknown as ProductWithOffers;
  const html = render(<OfferLedgerPreview product={product} market={{ code: 'GE' } as Parameters<typeof Hero>[0]['market']} />);
  for (const text of ['$129.99', '$4.99', '$134.98', 'Not provided', 'Most recent offer check',
    'Customs, duties and other import costs are not calculated.', '2 listed offers']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Best Price')); assert.ok(!html.includes('Visit merchant'));
  assert.ok(!html.includes('Lowest known total'));

  const comparable = { ...product, offers: [product.offers[0], { ...product.offers[0], id: 'other', priceAmount: 13999 }] } as ProductWithOffers;
  const comparableHtml = render(<OfferLedgerPreview product={comparable} market={{ code: 'GE' } as Parameters<typeof Hero>[0]['market']} />);
  assert.equal((comparableHtml.match(/Lowest known total/g) || []).length, 1);

  const mixed = { ...product, offers: [{ ...product.offers[0], currencyCode: 'GEL' }, product.offers[1]] } as ProductWithOffers;
  const mixedHtml = render(<OfferLedgerPreview product={mixed} market={{ code: 'GE' } as Parameters<typeof Hero>[0]['market']} />);
  assert.ok(mixedHtml.includes('aria-label="Total not calculated"')); assert.ok(mixedHtml.includes('—'));
});

test('commitments, merchant sources and trust copy make no payment or partnership claims', () => {
  const html = render(<><HomeCommitments /><MerchantSources market="GE" /><TrustSection market="GE" /></>);
  for (const text of ['sell products.', 'sell ranking.', 'hide the merchant.',
    'Know where the offers come from.', 'eBay', 'AliExpress', 'FMTC', 'does not imply a partnership',
    'Customs, duties and full landed cost are not calculated.']) assert.ok(html.includes(text), text);
  assert.ok(html.includes('/how-it-works?market=GE'));
  assert.ok(html.includes('/affiliate-disclosure?market=GE'));
  assert.ok(!html.includes('Ask BYB'));
});

test('shelf retains every product and exposes named manual controls; slow interval', () => {
  const html = render(<DiscoveryShelf label="Discover" autoRotate><button>First</button><button>Last</button></DiscoveryShelf>);
  assert.ok(html.includes('First')); assert.ok(html.includes('Last'));
  assert.ok(html.includes('aria-label="Previous listings — Discover"'));
  assert.ok(html.includes('aria-label="Next listings — Discover"'));
  assert.ok(!html.includes('aria-live="assertive"'));
  assert.ok(SHELF_INTERVAL_MS >= 8000);
});

test('device-only interests deduplicate, expire, bound storage, clear, and tolerate denied storage', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key),
  } });
  try {
    for (let i = 0; i < 20; i++) rememberInterest({ kind: 'product', id: `product-${i}`, market: 'GE' });
    assert.equal(readInterests().length, 12);
    rememberInterest({ kind: 'product', id: 'product-19', market: 'GE' });
    assert.equal(readInterests().filter(entry => entry.id === 'product-19').length, 1);
    assert.equal(readInterests(Date.now() + 31 * 86400000).length, 0);
    entries.set('byb-interests-v1', '{bad json'); assert.deepEqual(readInterests(), []);
    entries.set('byb-interests-v1', JSON.stringify([{ kind: 'search', id: 'private query', market: 'GE', seenAt: Date.now() }]));
    assert.deepEqual(readInterests(), []);
    clearInterests(); assert.equal(entries.size, 0);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('denied'); } });
    assert.deepEqual(readInterests(), []);
    assert.doesNotThrow(() => rememberInterest({ kind: 'category', id: 'auto', market: 'GE' }));
    assert.doesNotThrow(clearInterests);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});


test('Electronics opens the catalog-backed headphones query without an invented category filter', () => {
  for (const market of ['GE', 'AM', 'AZ']) {
    const url = new URL(categorySearchHref('electronics', market), 'https://byb.example.test');
    const request = requestForState(searchState(Object.fromEntries(url.searchParams)));
    assert.equal(request?.q, 'headphones');
    assert.equal(request?.market, market);
    assert.equal(request?.category, undefined);
    // Representative existing catalog fixtures, kept local so frontend Docker builds
    // do not depend on backend source files being copied into the image.
    const catalog = [
      { name: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones', category: 'headphones' },
      { name: 'Samsung Galaxy S24 Ultra 256GB - Used Excellent', category: 'smartphones' },
    ];
    const matches = catalog.filter(product => product.name.toLowerCase().includes(request!.q.toLowerCase()));
    assert.ok(matches.length > 0, 'Electronics query must match existing electronics fixtures');
    assert.ok(matches.every(product => product.category === 'headphones'));
    const html = render(<ExploreSection market={market} />);
    assert.ok(html.includes(`q=headphones&amp;market=${market}`));
  }
});
