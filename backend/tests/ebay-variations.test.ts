import { describe, it, expect, vi } from 'vitest';
import { EbayProvider } from '../src/modules/provider/ebay/ebay-provider.js';
import type { EbayBrowseClient } from '../src/modules/provider/ebay/client.js';
import { normalizeVariations } from '../src/modules/provider/ebay/variations.js';

const identity = { itemGroupId: '123456', itemGroupType: 'SELLER_DEFINED_VARIATIONS' };
function member(id: string, capacity: string, color: string, price: string, status = 'IN_STOCK') {
  return { itemId: `v1|123456|${id}`, title: 'Fixture phone', buyingOptions: ['FIXED_PRICE'],
    primaryItemGroup: identity, price: { value: price, currency: 'USD' },
    itemWebUrl: `https://www.ebay.com/itm/123456?var=${id}`,
    image: { imageUrl: `https://i.ebayimg.com/images/${id}.jpg` },
    additionalImages: [{ imageUrl: `https://i.ebayimg.com/images/${id}-extra.jpg` }],
    localizedAspects: [{ name: 'Capacity', value: capacity }, { name: 'Color', value: color }, { name: 'Brand', value: 'Fixture' }],
    estimatedAvailabilities: [{ estimatedAvailabilityStatus: status }],
    seller: { username: 'private-seller' }, itemAffiliateWebUrl: 'private-affiliate',
  };
}
const first = member('1', '32GB', 'Black', '99.00');
const second = member('2', '128GB', 'Black', '149.00');
const third = member('3', '128GB', 'Silver', '159.00');
const fourth = member('4', '256GB', 'Blue', '199.00', 'OUT_OF_STOCK');
const payload = { items: [first, second, third, fourth] };
function setup(detail: unknown = first, group: unknown = payload) {
  const get = vi.fn().mockImplementation(async (path: string) => path === '/item/get_items_by_item_group' ? group
    : path === '/item_summary/search' ? { total: 1, itemSummaries: [first] } : detail);
  let now = 0;
  const provider = new EbayProvider({ get } as unknown as EbayBrowseClient, 'production', () => now);
  return { get, provider, advance: (milliseconds: number) => { now += milliseconds; } };
}
describe('detail-only eBay variations', () => {
  it('skips group lookup for ordinary single items', async () => {
    const { provider, get } = setup({ ...first, primaryItemGroup: undefined });
    expect((await provider.getProduct(first.itemId, 'GE'))?.variationGroup).toBeUndefined();
    expect(get).toHaveBeenCalledTimes(1);
  });
  it('normalizes only real combinations with exact prices, currencies, images and destinations', async () => {
    const { provider, get } = setup();
    const detail = await provider.getProduct(first.itemId, 'GE');
    expect(get).toHaveBeenLastCalledWith('/item/get_items_by_item_group', 'EBAY_US', { item_group_id: '123456' });
    expect(detail?.variationGroup?.dimensions).toEqual([
      { name: 'Capacity', values: ['32GB', '128GB', '256GB'] }, { name: 'Color', values: ['Black', 'Silver', 'Blue'] },
    ]);
    expect(detail?.variationGroup?.variants.map(variant => variant.priceAmount)).toEqual([9900, 14900, 15900, 19900]);
    expect(detail?.variationGroup?.variants[2]).toMatchObject({ externalProductId: third.itemId,
      selections: { Capacity: '128GB', Color: 'Silver' }, currencyCode: 'USD', destinationUrl: third.itemWebUrl,
      images: [third.image.imageUrl, third.additionalImages[0]!.imageUrl], availability: 'in_stock' });
    expect(detail?.variationGroup?.variants).toHaveLength(4);
    expect(detail?.variationGroup?.variants[3]?.availability).toBe('out_of_stock');
    expect(JSON.stringify(detail?.variationGroup)).not.toMatch(/private|seller|affiliate/i);
  });
  it('preserves different source currencies without conversion', () => {
    const group = normalizeVariations({ items: [first, { ...second, price: { value: '12.50', currency: 'EUR' } }] }, '123456');
    expect(group?.variants[1]).toMatchObject({ priceAmount: 1250, currencyCode: 'EUR' });
  });
  it('ignores malformed or unrelated members', () => {
    const group = normalizeVariations({ items: [null, {}, first, second,
      { ...third, price: { value: 'invalid', currency: 'USD' } },
      { ...third, primaryItemGroup: { ...identity, itemGroupId: '999' } }] }, '123456');
    expect(group?.variants).toHaveLength(2);
  });
  it('rejects ambiguous combinations instead of guessing which price to display', () => {
    expect(normalizeVariations({ items: [first, second, { ...second, itemId: 'other' }] }, '123456')).toBeUndefined();
  });
  it('uses availability quantities and end dates to disable unavailable members', () => {
    for (const data of [{ itemEndDate: '2000-01-01T00:00:00Z' },
      { estimatedAvailabilities: [{ estimatedAvailableQuantity: 0 }] },
      { estimatedAvailabilities: [{ estimatedRemainingQuantity: 0 }] }]) {
      expect(normalizeVariations({ items: [first, { ...second, ...data }] }, '123456')?.variants[1]?.availability).toBe('out_of_stock');
    }
  });
  it('caches successful groups across member requests and expires after ten minutes', async () => {
    const { provider, get, advance } = setup();
    await provider.getProduct(first.itemId, 'GE');
    await provider.getProduct(first.itemId, 'GE');
    expect(get.mock.calls.filter(([path]) => path === '/item/get_items_by_item_group')).toHaveLength(1);
    advance(600001);
    await provider.getProduct(first.itemId, 'GE');
    expect(get.mock.calls.filter(([path]) => path === '/item/get_items_by_item_group')).toHaveLength(2);
  });
  it('returns ordinary detail on group failure and retries rather than caching failure', async () => {
    const { provider, get } = setup();
    get.mockImplementation(async (path: string) => {
      if (path === '/item/get_items_by_item_group') throw new Error('private-provider-error');
      return first;
    });
    for (let count = 0; count < 2; count++) {
      const detail = await provider.getProduct(first.itemId, 'GE');
      expect(detail?.variationGroup).toBeUndefined();
      expect(detail).toMatchObject({ priceAmount: 9900, destinationUrl: first.itemWebUrl });
    }
    expect(get.mock.calls.filter(([path]) => path === '/item/get_items_by_item_group')).toHaveLength(2);
  });
  it('does not fetch groups or expose variations during search, including aspect enrichment', async () => {
    const { provider, get } = setup();
    for (const intent of [{ query: 'phone' }, { query: 'phone', brand: 'Fixture' }]) {
      const result = await provider.search(intent, 'GE');
      expect(result.products[0]?.variationGroup).toBeUndefined();
    }
    expect(get.mock.calls.some(([path]) => path === '/item/get_items_by_item_group')).toBe(false);
  });
  it('ignores untrusted group references and unknown types', async () => {
    const { provider, get } = setup({ ...first, primaryItemGroup: { itemGroupId: '../secret', itemGroupType: 'SELLER_DEFINED_VARIATIONS', itemGroupHref: 'http://internal/' } });
    await provider.getProduct(first.itemId, 'GE');
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe('sanitized production Browse fixture (2026-10-23)', () => {
  it('normalizes six real iPhone members with differing prices, colors, storage and stock', async () => {
    const { default: fixture } = await import('./fixtures/ebay-variation-group.json');
    const group = normalizeVariations(fixture, '227133051766');
    expect(group?.dimensions).toEqual([{ name: 'Color', values: ['Black', 'White'] },
      { name: 'Storage', values: ['128 GB', '256 GB', '512 GB'] }]);
    expect(group?.variants).toHaveLength(6);
    expect(new Set(group?.variants.map(variant => variant.priceAmount)).size).toBe(4);
    expect(new Set(group?.variants.map(variant => variant.images[0])).size).toBe(2);
    expect(group?.variants.filter(variant => variant.availability === 'out_of_stock')).toHaveLength(3);
  });
});
