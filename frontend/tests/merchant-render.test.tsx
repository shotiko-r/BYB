import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProductCard } from '../src/components/ProductCard';
import { ProductComparison } from '../src/components/ProductComparison';
import { DiscoverySections } from '../src/components/DiscoverySections';
import { ProductOfferSummary } from '../src/components/ProductOfferSummary';
import { ExploreSection } from '../src/components/ExploreSection';
import { Header } from '../src/components/Header';
import { Footer } from '../src/components/Footer';
import SearchPage from '../src/app/search/page';
import { homepageSections } from '../src/lib/homepage-sections';
import { readFileSync } from 'node:fs';
import { api } from '../src/lib/api';
import HomePage from '../src/app/page';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { requestForState, searchState } from '../src/lib/search-presentation';
import { ProductImage } from '../src/components/ProductImage';
import { I18nProvider } from '../src/i18n/I18nContext';
import { formatMoney } from '../src/lib/offer-prices';
import { merchantName } from '../src/lib/merchant';
import type { ProductWithOffers, Market } from '../src/types';

const market: Market = { id: 'ge', code: 'GE', name: 'Georgia', locale: 'ka-GE', language: 'ka', currencyCode: 'GEL', currencySymbol: '₾', isActive: true, createdAt: '', updatedAt: '' };
const destination = 'https://affiliate.example.test/click?campaign=synthetic&item=123&tag=a%2Bb';
function fixture(code = 'aliexpress', amount = 58): ProductWithOffers {
  return { id: 'product', slug: code, name: 'Clear Polycarbonate Observation Window', description: null, brand: null, model: null, categoryId: null, imageUrl: null, attributes: {}, isActive: true, createdAt: '', updatedAt: '', offers: [{ id: 'offer', productId: 'product', merchantId: code, marketId: 'ge', externalProductId: 'synthetic', priceAmount: amount, currencyCode: 'USD', availability: 'unknown', shippingInfo: {}, destinationUrl: destination, affiliateMetadata: {}, lastCheckedAt: '', isActive: true, createdAt: '', updatedAt: '', merchant: { id: code, code, name: code === 'ebay' ? 'eBay' : 'AliExpress', logoUrl: null } }] };
}
function renderView(view: React.ReactNode, enabled: boolean | undefined = true) {
  const previous = process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED;
  if (enabled === undefined) delete process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED;
  else process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED = String(enabled);
  try { return renderToStaticMarkup(<AppRouterContext.Provider value={{ push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {}, bfcacheId: 'test' }}><I18nProvider>{view}</I18nProvider></AppRouterContext.Provider>); }
  finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED;
    else process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED = previous;
  }
}
function render(product: ProductWithOffers, comparison = false, enabled = true) {
  return renderView(comparison ? <ProductComparison product={product} market={market} /> : <ProductCard product={product} market={market} onClick={() => {}} />, enabled);
}
function discovery(product: ProductWithOffers) {
  return <DiscoverySections productsBySection={{ discover: [product] }} market={market} onProductClick={() => {}} />;
}

for (const [code, name] of [['aliexpress', 'AliExpress'], ['ebay', 'eBay']]) {
  test(`${name} card and detail comparison preserve identity, currency and tracked URL`, () => {
    const product = fixture(code);
    product.imageUrl = 'https://images.example.test/product.jpg';
    for (const comparison of [false, true]) {
      const html = render(product, comparison);
      assert.ok(html.includes(name)); assert.ok(html.includes(`Buy on ${name}`));
      assert.ok(html.includes('$0.58')); assert.ok(!html.includes('₾'));
      assert.ok(html.includes(destination.replaceAll('&', '&amp;')));
      assert.ok(html.includes('rel="sponsored nofollow noopener noreferrer"'));
      assert.ok(html.includes('target="_blank"'));
      assert.ok(!html.includes('Merchant unavailable'));
      assert.ok(!html.includes('Free shipping')); assert.ok(!html.includes('In Stock'));
      if (!comparison) { assert.ok(html.includes(product.imageUrl)); assert.ok(!html.includes('Unknown')); }
    }
  });
}
test('minor units preserve the source currency', () => {
  for (const [amount, expected] of [[58, '$0.58'], [537, '$5.37'], [15999, '$159.99']] as const) assert.equal(formatMoney(amount, 'USD'), expected);
  assert.ok(formatMoney(537, 'GEL').includes('₾'));
  assert.equal(formatMoney(0, 'USD'), '$0.00');
});
test('missing merchant has a useful label and generic CTA; known codes have fallback names', () => {
  const product = fixture(); delete product.offers[0].merchant;
  for (const comparison of [false, true]) {
    const html = render(product, comparison);
    assert.ok(html.includes('Merchant unavailable')); assert.ok(html.includes('Visit merchant'));
    assert.ok(!html.includes('Buy on </'));
  }
  assert.equal(merchantName({ code: 'aliexpress', name: ' ' }), 'AliExpress');
  assert.equal(merchantName({ code: 'ebay' }), 'eBay');
});
test('missing images and long titles retain a bounded card fallback', () => {
  const product = fixture(); product.name = 'LongTitle'.repeat(100);
  const html = render(product);
  assert.ok(html.includes('role="img"')); assert.ok(html.includes('BYB'));
  assert.ok(html.includes('line-clamp-2')); assert.ok(html.includes('break-words'));
  assert.ok(!html.includes('src=""'));
  assert.ok(renderToStaticMarkup(<ProductImage src={null} alt="Missing image" sizes="100vw" />).includes('aria-label="Missing image"'));
});

test('internal feed identity is not shown as a product specification', () => {
  const product = fixture(); product.attributes = { source: 'admitad-feed', sourceIdentity: 'synthetic-identity', material: 'Polycarbonate' };
  const html = render(product, true);
  assert.ok(!html.includes('synthetic-identity')); assert.ok(!html.includes('admitad-feed'));
  assert.ok(html.includes('Polycarbonate'));
});


test('single-offer homepage, search and detail use details framing and suppress unknowns', () => {
  const product = fixture('ebay');
  product.brand = 'Unknown'; product.attributes.condition = 'Unknown';
  const views = [discovery(product), <ProductCard key="card" product={product} market={market} onClick={() => {}} />,
    <ProductComparison key="comparison" product={product} market={market} />, <ProductOfferSummary key="summary" product={product} />];
  for (const view of views) {
    const html = renderView(view);
    assert.ok(html.includes('eBay')); assert.ok(html.includes('$0.58'));
    for (const misleading of ['Compare 1 offers', 'Compare Prices', 'Best Offer', 'Best Price', 'Unknown']) assert.ok(!html.includes(misleading), misleading);
  }
  assert.ok(renderView(discovery(product)).includes('View details'));
  assert.ok(render(product).includes('View details'));
});

test('two eligible offers use comparison text; inactive offers do not inflate counts', () => {
  const product = fixture('ebay');
  product.offers.push({ ...product.offers[0], id: 'second', externalProductId: 'second', priceAmount: 100 });
  assert.ok(render(product).includes('Compare 2 offers'));
  assert.ok(renderView(discovery(product)).includes('Compare 2 offers'));
  assert.ok(render(product, true).includes('Compare Prices'));
  assert.ok(!render(product).includes('stores'));
  product.offers[1].isActive = false;
  assert.ok(!render(product).includes('Compare 2 offers'));
  assert.ok(!render(product, true).includes('Compare Prices'));
});

test('known condition is visible without internal IDs or provider objects', () => {
  const product = fixture('ebay');
  product.attributes = { condition: 'Used', conditionId: 'internal-condition-id', listingIdentity: 'internal-listing-id',
    epid: 'internal-epid', seller: { feedbackScore: 100 }, categories: [{ categoryName: 'synthetic' }], material: 'Aluminium' };
  for (const view of [discovery(product), <ProductCard key="card" product={product} market={market} onClick={() => {}} />,
    <ProductComparison key="comparison" product={product} market={market} />, <ProductOfferSummary key="summary" product={product} />]) {
    const html = renderView(view); assert.ok(html.includes('Used'));
    for (const internal of ['internal-condition-id', 'internal-listing-id', 'internal-epid', '[object Object]']) assert.ok(!html.includes(internal));
  }
  assert.ok(render(product, true).includes('Aluminium'));
});

test('AliExpress disabled clickouts preserve discovery, merchant, price and internal details', () => {
  const product = fixture();
  for (const view of [discovery(product), <ProductCard key="card" product={product} market={market} onClick={() => {}} />,
    <ProductComparison key="comparison" product={product} market={market} />, <ProductOfferSummary key="summary" product={product} />]) {
    const html = renderView(view, false);
    assert.ok(html.includes('AliExpress')); assert.ok(html.includes('$0.58'));
    assert.ok(html.includes('Merchant link temporarily unavailable'));
    assert.ok(!html.includes('href="https://affiliate.example.test'));
    assert.ok(!html.includes('Buy on AliExpress'));
  }
  assert.ok(render(product, false, false).includes('aria-disabled="true"'));
  assert.ok(renderView(discovery(product), false).includes('View details'));
});

test('AliExpress clickouts fail closed by default and opt-in preserves exact tracked URL', () => {
  const product = fixture();
  // Call without the helper default to explicitly test an unset build flag.
  const previous = process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED;
  delete process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED;
  try {
    const html = renderToStaticMarkup(<I18nProvider><ProductOfferSummary product={product} /></I18nProvider>);
    assert.ok(html.includes('Merchant link temporarily unavailable'));
  } finally {
    if (previous !== undefined) process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED = previous;
  }
  for (const view of [<ProductCard key="card" product={product} market={market} onClick={() => {}} />,
    <ProductComparison key="comparison" product={product} market={market} />, <ProductOfferSummary key="summary" product={product} />]) {
    const html = renderView(view, true);
    assert.ok(html.includes('Buy on AliExpress')); assert.ok(html.includes(destination.replaceAll('&', '&amp;')));
    assert.ok(!html.includes('Merchant link temporarily unavailable'));
  }
});

test('eBay clickouts remain active when AliExpress is disabled', () => {
  const html = render(fixture('ebay'), false, false);
  assert.ok(html.includes('Buy on eBay')); assert.ok(html.includes(destination.replaceAll('&', '&amp;')));
  assert.ok(!html.includes('aria-disabled="true"'));
});

test('mixed source currencies never claim a best price or best offer', () => {
  const product = fixture('ebay', 15000);
  product.offers.push({ ...product.offers[0], id: 'gel', externalProductId: 'gel', currencyCode: 'GEL', priceAmount: 10000 });
  for (const html of [render(product, true), renderView(<ProductOfferSummary product={product} />)]) {
    assert.ok(html.includes('$150.00')); assert.ok(html.includes(formatMoney(10000, 'GEL')));
    assert.ok(!html.includes('Best Price')); assert.ok(!html.includes('Best Offer'));
  }
});

test('homepage shelves and navigation use truthful labels and implemented destinations', () => {
  const html = renderView(<><Header markets={[market]} selectedMarket={market} onMarketChange={() => {}} />
    <ExploreSection /><DiscoverySections productsBySection={{}} market={market} onProductClick={() => {}} /><Footer /></>);
  for (const label of ['Discover', 'New on BYB', 'Under US$25', 'Under US$50', 'More to Explore']) assert.ok(html.includes(label));
  for (const label of ['Trending', 'Popular', 'Best Deals', 'New Releases', 'Hard to Find', 'Price Drops']) assert.ok(!html.includes(label));
  for (const route of ['/deals', '/new', '/rare', '/trending', '/categories']) assert.ok(!html.includes(`href="${route}`), route);
  assert.deepEqual(homepageSections.map(section => section.key), ['discover', 'new_on_byb', 'under_25_usd', 'under_50_usd', 'more_to_explore']);
  const headings = [...html.matchAll(/<h2[^>]*id="discovery-([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(headings, homepageSections.map(section => section.key));
  assert.ok(!html.includes('View all →'));

});

test('search page input reflects resolved URL query and sort remains visible without results', async () => {
  const page = await SearchPage({ searchParams: Promise.resolve({ q: 'Sony WH-1000XM5', market: 'GE', sort: 'newest' }) });
  const html = renderView(page);
  assert.match(html, /<input[^>]+type="search"[^>]+value="Sony WH-1000XM5"/);
  assert.ok(html.includes('id="sort"')); assert.ok(html.includes('value="newest" selected=""'));
  assert.ok(!html.includes('&lt;strong&gt;'));
});

test('clear/blank search cannot create an invalid API request; URL budgets are preserved', () => {
  assert.equal(requestForState(searchState({ q: '' })), undefined);
  assert.equal(requestForState(searchState({ q: '   ' })), undefined);
  const params = { currencyCode: 'USD', maxPrice: '2499' };
  assert.deepEqual(requestForState(searchState({ ...params, q: 'headphones', sort: 'price_asc' })), {
    q: 'headphones', market: 'GE', page: 1, limit: 20, sort: 'price_asc', currency: 'USD', maxPrice: '2499', minPrice: undefined, merchant: undefined, category: undefined,
  });
});


test('homepage calls combined discovery instead of keyword searches; client sends one request', async () => {
  const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('api.discovery.home(selectedMarket.code, controller.signal)'));
  assert.ok(!source.includes('api.search.products')); assert.ok(!source.includes('Promise.all'));
  const previous = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async input => {
    calls.push(String(input));
    return Response.json({ market: 'GE', generatedAt: '2026-10-21T12:00:00.000Z', rotationBucket: '2026-10-21', algorithmVersion: 'discovery-v1',
      sections: homepageSections.map(section => ({ key: section.key, titleKey: section.titleKey, status: 'ok', products: [] })) });
  };
  try {
    const response = await api.discovery.home('GE');
    assert.equal(calls.length, 1); assert.equal(new URL(calls[0]).pathname, '/api/discovery/home');
    assert.deepEqual(response.sections.map(section => section.key), homepageSections.map(section => section.key));
  } finally { globalThis.fetch = previous; }
});

test('homepage initial state renders section skeletons', () => {
  const html = renderView(<HomePage />);
  assert.equal((html.match(/role="status"/g) || []).length, 5);
  assert.ok(html.includes('animate-pulse'));
  assert.ok(!html.includes('No matching listings available.'));
});

test('section errors are recoverable while successful sibling cards remain visible', () => {
  const html = renderView(<DiscoverySections productsBySection={{ discover: [fixture('ebay')] }} market={market} onProductClick={() => {}}
    unavailableSections={['under_25_usd']} onRetry={() => {}} />);
  assert.ok(html.includes('eBay')); assert.ok(html.includes('View details'));
  assert.equal((html.match(/role="alert"/g) || []).length, 1);
  assert.ok(html.includes('This section is temporarily unavailable. Please try again.'));
  assert.ok(html.includes('Retry'));
  const failed = renderView(<DiscoverySections productsBySection={{}} market={market} onProductClick={() => {}} failed onRetry={() => {}} />);
  assert.equal((failed.match(/role="alert"/g) || []).length, 5);
  assert.ok(!failed.includes('No matching listings available.'));
});

test('discovery shelves preserve separate mixed-currency cards and disabled AliExpress details', () => {
  const usd = fixture('aliexpress', 1500); const gel = fixture('ebay', 4500);
  gel.id = 'gel-product'; gel.offers[0].currencyCode = 'GEL';
  const html = renderView(<DiscoverySections productsBySection={{ discover: [usd, gel] }} market={market} onProductClick={() => {}} />, false);
  assert.ok(html.includes('$15.00')); assert.ok(html.includes(formatMoney(4500, 'GEL')));
  assert.ok(html.includes('AliExpress')); assert.ok(html.includes('eBay'));
  assert.ok(html.includes('Merchant link temporarily unavailable'));
  assert.equal((html.match(/View details/g) || []).length, 2);
  assert.ok(!html.includes('Compare 1 offers')); assert.ok(!html.includes('Best Price'));
});
