import { describe, it, expect, vi } from 'vitest';
import fixture from './fixtures/ebay-ipod-variation-group.json';
import { EbayProvider } from '../src/modules/provider/ebay/ebay-provider.js';
import { EbayBrowseClient } from '../src/modules/provider/ebay/client.js';
import { EbayTokenManager } from '../src/modules/provider/ebay/auth.js';
import { normalizeVariations } from '../src/modules/provider/ebay/variations.js';
import { mapItem } from '../src/modules/provider/ebay/mapping.js';
import { EbayProductDetailEnricher } from '../src/modules/product/detail-enrichment.js';
import { InMemoryProviderRegistry } from '../src/modules/provider/registry.js';
import type { ProductWithOffers } from '@byb/shared/types';

const config = { environment: 'production' as const, clientId: 'fixture-id', clientSecret: 'fixture-secret' };
const dimensions = ['Generation', 'Color', 'Condition', 'Storage Capacity'];
function client(http: typeof fetch) { return new EbayBrowseClient(config, new EbayTokenManager(config, http), http); }
function largeGroupBody() {
  const response = { items: fixture.items, commonDescriptions: [{ description: '' }] };
  const size = Buffer.byteLength(JSON.stringify(response));
  response.commonDescriptions[0]!.description = 'x'.repeat(1714036 - size);
  return JSON.stringify(response);
}

describe('P2.2R real iPod listing regression', () => {
  it('keeps all four source dimensions, exact current ID and all 83 real combinations', () => {
    const group = normalizeVariations(fixture, '358020906068')!;
    expect(group.dimensions.map(dimension => dimension.name)).toEqual(dimensions);
    expect(group.variants).toHaveLength(83);
    expect(new Set(group.variants.map(variant => variant.externalProductId)).size).toBe(83);
    expect(new Set(group.variants.map(variant => JSON.stringify(variant.selections))).size).toBe(83);
    expect(group.variants.map(variant => variant.externalProductId)).toEqual(fixture.items.map(item => item.itemId));
    const current = group.variants.find(variant => variant.externalProductId === fixture.currentExternalProductId)!;
    expect(current.selections).toEqual({ Generation: '5th Generation', Color: 'Black', Condition: 'Very Good', 'Storage Capacity': '30 GB' });
    expect(current.priceAmount).toBe(14999);
    expect(current.destinationUrl).toContain('var=626788065835');
    expect(group.variants[0]?.priceAmount).toBe(20999);
    expect(group.variants.find(variant => variant.externalProductId === 'v1|358020906068|626788065832'))
      .toMatchObject({ priceAmount: 13999, availability: 'in_stock', selections: { Condition: 'Good' } });
    expect(group.variants.filter(variant => variant.availability === 'out_of_stock')).toHaveLength(36);
    for (const variant of group.variants) {
      const source = fixture.items.find(item => item.itemId === variant.externalProductId)!;
      expect(variant.images[0]).toBe(source.image.imageUrl);
      expect(variant.currencyCode).toBe(source.price.currency);
    }
  });

  it('loads the observed >1 MiB group through the real client, provider and detail enricher', async () => {
    const body = largeGroupBody();
    expect(Buffer.byteLength(body)).toBe(1714036);
    const http = vi.fn<typeof fetch>().mockImplementation(async url => {
      const path = new URL(String(url)).pathname;
      if (path.includes('/identity/')) return Response.json({ access_token: 'fixture-token', expires_in: 3600 });
      if (path.endsWith('/get_items_by_item_group')) return new Response(body);
      return Response.json(fixture.detail);
    });
    const provider = new EbayProvider(client(http));
    const registry = new InMemoryProviderRegistry(); registry.register(provider);
    const original = { id: 'a76c7409-f577-4cac-a141-d1731991d29f', attributes: { source: 'ebay_browse' }, imageUrl: null,
      description: null, offers: [{ externalProductId: fixture.currentExternalProductId, priceAmount: 14999,
        isActive: true, merchant: { code: 'ebay' } }] } as unknown as ProductWithOffers;
    const result = await new EbayProductDetailEnricher(registry).enrich(original, 'GE');
    const publicDetail = JSON.parse(JSON.stringify(result));
    expect(publicDetail.variationGroup?.variants).toHaveLength(83);
    expect(publicDetail.variationGroup.dimensions.map((dimension: { name: string }) => dimension.name)).toEqual(dimensions);
    expect(result.offers).toBe(original.offers);
    expect(result.attributes).not.toHaveProperty('variationLookupFailed');
  });

  it('matches the public description fixture consumed by the frontend regression', () => {
    const detail = mapItem({ ...fixture.detail, description: fixture.descriptionHtml }, { detail: true })!;
    expect(detail.description).toBe(fixture.expectedDescription);
  });

  it('keeps group responses bounded at 2 MiB and ordinary Browse responses at 1 MiB', async () => {
    for (const [path, size] of [['/item/get_items_by_item_group', 2097153], ['/item_summary/search', 1048577], ['/item/test', 1048577]] as const) {
      const http = vi.fn<typeof fetch>().mockImplementation(async url => String(url).includes('/identity/')
        ? Response.json({ access_token: 'fixture-token', expires_in: 3600 }) : new Response('x'.repeat(size)));
      await expect(client(http).get(path, 'EBAY_US')).rejects.toMatchObject({ code: 'malformed' });
    }
  });

  it.each(['Suggested Products', 'Related Products', 'Similar Products', 'You May Also Like', 'Other Items', 'Similar Items', '·  ·  ·   Suggested Products   ·  ·  ·'])
  ('truncates only a clear separated cross-sell heading: %s', heading => {
    const item = mapItem({ ...fixture.detail,
      description: `<p>Actual iPod description.</p><ul><li>Tested battery</li></ul><p>${heading}</p><p>Unrelated product $124.95</p>` }, { detail: true })!;
    expect(item.description).toContain('Actual iPod description.');
    expect(item.description).toContain('Tested battery');
    expect(item.description).not.toContain('Suggested Products');
    expect(item.description).not.toContain('Unrelated');
    expect(item.description).not.toContain('$124.95');
    expect(item.priceAmount).toBe(14999);
  });

  it.each([
    '<p>Suggested products can be paired with this iPod.</p>',
    '<p>Actual description mentions Related Products in a sentence.</p>',
    '<p>Other items included: USB cable.</p>',
    '<p>Actual description<br>Suggested Products<br>This is not a separated section.</p>',
    '<p>Suggested Products</p><p>Without preceding description, retain text.</p>',
  ])('retains ordinary prose and uncertain boundaries', description => {
    const item = mapItem({ ...fixture.detail, description }, { detail: true })!;
    expect(item.description).toMatch(/Suggested [Pp]roducts|Related Products|Other items/);
  });
});
