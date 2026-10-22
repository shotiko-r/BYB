import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { VariationGroup } from '@byb/shared/types';
import type { ProductWithOffers, Market } from '../src/types';
import { ProductDetailContent } from '../src/components/ProductDetailContent';
import { ProductVariations } from '../src/components/ProductVariations';
import { ProductDescription } from '../src/components/ProductDescription';
import { I18nProvider } from '../src/i18n/I18nContext';
import { initialSelections, matchingVariant, productVariationGroup, variationOptionEnabled, variationProduct } from '../src/lib/product-variations';
const group: VariationGroup = {
  dimensions: [{ name: 'Capacity', values: ['32GB', '128GB', '256GB'] }, { name: 'Color', values: ['Black', 'Silver', 'Blue'] }],
  variants: [['one','32GB','Black',9900], ['two','128GB','Black',14900], ['three','128GB','Silver',15900], ['four','256GB','Blue',19900]].map(([id, capacity, color, price], index) => ({
    externalProductId: String(id), selections: { Capacity: String(capacity), Color: String(color) }, priceAmount: Number(price), currencyCode: 'USD',
    images: [`https://i.ebayimg.com/images/${id}.jpg`], availability: index === 3 ? 'out_of_stock' : 'in_stock',
    destinationUrl: `https://www.ebay.com/itm/123?var=${id}`, shippingInfo: {},
  })),
};
const product = { id: 'product', name: 'Phone', attributes: { source: 'ebay_browse' }, variationGroup: group,
  imageUrl: 'https://i.ebayimg.com/images/original.jpg', description: 'Short description',
  offers: [{ id: 'offer', externalProductId: 'two', priceAmount: 15000, currencyCode: 'USD', availability: 'in_stock',
    isActive: true, merchant: { code: 'ebay', name: 'eBay' }, destinationUrl: 'https://www.ebay.com/itm/original', shippingInfo: {} }],
} as unknown as ProductWithOffers;
const render = (view: React.ReactNode) => renderToStaticMarkup(<I18nProvider>{view}</I18nProvider>);
const market = { code: 'GE' } as Market;
test('current member is initial selection, never the cheaper member', () => {
  assert.deepEqual(initialSelections(product, group), { Capacity: '128GB', Color: 'Black' });
  const html = render(<ProductDetailContent product={product} market={market} />);
  assert.ok(html.includes('$149.00'));
  assert.ok(html.includes('value="128GB" selected=""'));
  assert.ok(html.includes('var=two'));
});
test('capacity and color changes resolve exact price, currency, images, identity and CTA', () => {
  for (const selections of [{ Capacity: '32GB', Color: 'Black' }, { Capacity: '128GB', Color: 'Silver' }]) {
    const selected = matchingVariant(group, selections)!;
    const displayed = variationProduct(product, group, selections);
    assert.equal(displayed.offers[0].priceAmount, selected.priceAmount);
    assert.equal(displayed.offers[0].externalProductId, selected.externalProductId);
    assert.equal(displayed.offers[0].destinationUrl, selected.destinationUrl);
    assert.equal(displayed.imageUrl, selected.images[0]);
    const html = render(<ProductDetailContent product={displayed} market={market} />);
    assert.ok(html.includes(selected.destinationUrl));
    assert.ok(html.includes(selected.images[0]));
  }
  assert.equal(product.offers[0].priceAmount, 15000);
});
test('impossible and unavailable combinations are disabled; clearing permits other combinations', () => {
  assert.equal(variationOptionEnabled(group, { Capacity: '32GB' }, 'Color', 'Silver'), false);
  assert.equal(variationOptionEnabled(group, {}, 'Color', 'Blue'), false);
  assert.equal(variationOptionEnabled(group, {}, 'Color', 'Silver'), true);
  const html = render(<ProductVariations group={group} selections={{ Capacity: '32GB', Color: 'Black' }} onChange={() => {}} />);
  assert.ok(html.includes('value="Silver" disabled=""'));
  assert.ok(html.includes('value="Blue" disabled=""'));
  assert.ok(html.includes('<label'));
  assert.ok(html.includes('Clear selections'));
});
test('unresolved current member and partial selections keep original detail', () => {
  assert.deepEqual(initialSelections({ ...product, offers: [{ ...product.offers[0], externalProductId: 'unknown' }] }, group), {});
  assert.equal(variationProduct(product, group, { Capacity: '32GB' }), product);
  assert.equal(variationProduct(product, group, { Capacity: '32GB', Color: 'Silver' }), product);
});
test('a member without its own images retains existing gallery', () => {
  const withoutImages = { ...group, variants: group.variants.map(variant => ({ ...variant, images: [] })) };
  assert.equal(variationProduct(product, withoutImages, initialSelections(product, group)).imageUrl, product.imageUrl);
});
test('single variant, ordinary listings and AliExpress have no controls', () => {
  for (const item of [{ ...product, variationGroup: { ...group, variants: [group.variants[0]] } },
    { ...product, variationGroup: undefined }, { ...product, attributes: { source: 'aliexpress_feed' } }]) {
    assert.equal(productVariationGroup(item), undefined);
    assert.ok(!render(<ProductDetailContent product={item} market={market} />).includes('<fieldset'));
  }
});
test('out-of-stock current member has a disabled purchase action', () => {
  const item = { ...product, offers: [{ ...product.offers[0], externalProductId: 'four' }] };
  const html = render(<ProductDetailContent product={item} market={market} />);
  assert.ok(html.includes('aria-disabled="true"'));
  assert.ok(!html.includes('href="https://www.ebay.com/itm/123?var=four"'));
});
test('description styles bound desktop/tablet/mobile height and allow vertical keyboard scrolling', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  for (const value of ['max-height: 480px', 'max-height: 420px', 'max-height: 360px', 'overflow-y: auto', 'overflow-x: hidden', 'scrollbar-width: thin']) assert.ok(css.includes(value));
  const html = render(<ProductDescription text="Short description" />);
  assert.ok(html.includes('tabindex="0"'));
  assert.ok(!html.includes('Show more'));
});
