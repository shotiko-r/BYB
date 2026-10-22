import React from 'react';
import { getAllMockProducts } from '../../backend/src/modules/provider/mock/mock-data';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExploreSection } from '../src/components/ExploreSection';
import { Hero } from '../src/components/Hero';
import { DiscoveryShelf, SHELF_INTERVAL_MS } from '../src/components/DiscoveryShelf';
import { I18nProvider } from '../src/i18n/I18nContext';
import { homepageCategories, categorySearchHref } from '../src/lib/homepage-categories';
import { requestForState, searchState } from '../src/lib/search-presentation';
import { readInterests, rememberInterest, clearInterests } from '../src/lib/local-interests';

const render = (view: React.ReactNode) => renderToStaticMarkup(<I18nProvider>{view}</I18nProvider>);

test('eight curated category entries use real search URLs and preserve selected market', () => {
  assert.equal(homepageCategories.length, 8);
  const html = render(<ExploreSection market="AM" />);
  assert.equal((html.match(/class="home-category home-category-/g) || []).length, 8);
  for (const category of homepageCategories) {
    const url = new URL(categorySearchHref(category.id, 'AM'), 'https://byb.example.test');
    assert.equal(url.pathname, '/search'); assert.equal(url.searchParams.get('market'), 'AM');
    assert.equal(url.searchParams.get('q'), category.query); assert.equal(url.searchParams.has('category'), false);
  }
  assert.ok(!html.includes('Coming soon'));
});

test('homepage hero leads with discovery copy and secondary search link, not a search form', () => {
  const market = { code: 'GE' } as Parameters<typeof Hero>[0]['market'];
  const html = render(<Hero market={market} />);
  assert.ok(html.includes('Find your next good find.'));
  assert.ok(html.includes('/search?market=GE'));
  assert.ok(!html.includes('<input')); assert.ok(!html.includes('<form'));
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
    // Existing seeded/demo catalog evidence, not an invented broad category match.
    const matches = getAllMockProducts().filter(product => product.name.toLowerCase().includes(request!.q.toLowerCase()));
    assert.ok(matches.length > 0, 'Electronics query must match existing electronics fixtures');
    assert.ok(matches.every(product => product.category === 'headphones'));
    const html = render(<ExploreSection market={market} />);
    assert.ok(html.includes(`q=headphones&amp;market=${market}`));
  }
});
