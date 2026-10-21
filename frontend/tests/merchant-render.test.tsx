import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProductCard } from '../src/components/ProductCard';
import { ProductComparison } from '../src/components/ProductComparison';
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
function render(product: ProductWithOffers, comparison = false) {
  return renderToStaticMarkup(<I18nProvider>{comparison ? <ProductComparison product={product} market={market} /> : <ProductCard product={product} market={market} onClick={() => {}} />}</I18nProvider>);
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
