import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { decimalToMinor, minorToDecimal } from '@byb/shared';
import { searchState, searchHref, requestForState, clearedFilters, searchValidation, pricePatch } from '../src/lib/search-presentation';
import { LatestRequest, suggestionIndex } from '../src/lib/latest-request';
import { SearchFilters } from '../src/components/SearchFilters';
import { SearchResultsView } from '../src/components/SearchResults';
import { SearchInput } from '../src/components/SearchInput';
import { I18nProvider } from '../src/i18n/I18nContext';
import { api } from '../src/lib/api';

const render = (view: React.ReactNode) => renderToStaticMarkup(<I18nProvider>{view}</I18nProvider>);
const fromUrl = (url: string) => searchState(Object.fromEntries(new URL(url, 'https://byb.example.test').searchParams));

test('URL round trip reproduces query, market, sort, merchants, category, currency and minor-unit range', () => {
  const state = searchState({ q: 'Sony WH-1000XM5', market: 'GE', page: '3', sort: 'price_desc', merchant: 'ebay,aliexpress', category: 'headphones', currency: 'USD', minPrice: '100', maxPrice: '19999' });
  const url = searchHref(state, { page: state.page });
  assert.deepEqual(fromUrl(url), state);
  assert.ok(url.includes('merchant=aliexpress%2Cebay'));
  assert.ok(url.includes('currency=USD'));
  assert.ok(!url.includes('currencyCode='));
});

test('query, filter and sort changes reset page; page navigation preserves filters', () => {
  const state = searchState({ q: 'Sony', page: '8', merchant: 'ebay', currency: 'USD' });
  for (const patch of [{ q: 'Bose' }, { merchant: ['aliexpress'] }, { sort: 'newest' as const }, { category: 'headphones' }, { minPrice: '100' }]) {
    assert.equal(fromUrl(searchHref(state, patch)).page, 1);
  }
  const paged = fromUrl(searchHref(state, { page: 9 }));
  assert.equal(paged.page, 9); assert.equal(paged.currency, 'USD'); assert.deepEqual(paged.merchant, ['ebay']);
});

test('Back/Forward snapshots restore state without a second local applied-filter model', () => {
  const initial = searchState({ q: 'Sony', merchant: 'ebay' });
  const history = [searchHref(initial), searchHref(initial, { merchant: ['aliexpress'], sort: 'newest' })];
  assert.deepEqual(fromUrl(history[0]).merchant, ['ebay']);
  assert.equal(fromUrl(history[1]).sort, 'newest');
  assert.deepEqual(fromUrl(history[1]).merchant, ['aliexpress']);
  const back = render(<SearchResultsView searchParams={Object.fromEntries(new URL(history[0], 'https://byb.example.test').searchParams)} navigate={() => {}} />);
  const forward = render(<SearchResultsView searchParams={Object.fromEntries(new URL(history[1], 'https://byb.example.test').searchParams)} navigate={() => {}} />);
  assert.ok(back.includes('value="Sony"')); assert.ok(back.includes('ebay'));
  assert.ok(forward.includes('value="newest" selected=""')); assert.ok(forward.includes('aliexpress'));
});

test('clearing filters preserves query and market and removes price-sort currency requirements', () => {
  const state = searchState({ q: 'Sony', market: 'AM', page: '4', sort: 'price_asc', merchant: 'ebay', currency: 'USD', category: 'headphones', maxPrice: '1000' });
  const cleared = fromUrl(searchHref(state, clearedFilters()));
  assert.equal(cleared.q, 'Sony'); assert.equal(cleared.market, 'AM'); assert.equal(cleared.page, 1);
  assert.equal(cleared.currency, ''); assert.equal(cleared.category, ''); assert.deepEqual(cleared.merchant, []);
  assert.equal(cleared.sort, 'relevance'); assert.equal(cleared.maxPrice, '');
});

test('price sort/range requires an explicit supported currency and blank query creates no request', () => {
  for (const params of [{ sort: 'price_asc' }, { sort: 'price_desc' }, { minPrice: '0' }, { maxPrice: '500' }]) {
    const state = searchState({ q: 'headphones', ...params });
    assert.equal(searchValidation(state), 'currencyRequired'); assert.equal(requestForState(state), undefined);
  }
  assert.equal(requestForState(searchState({ q: '  ' })), undefined);
  assert.equal(searchValidation(searchState({ q: 'headphones', currency: 'XYZ' })), 'invalidCurrency');
  assert.equal(requestForState(searchState({ q: 'headphones' }))?.currency, undefined);
  assert.equal(requestForState(searchState({ q: 'headphones', sort: 'price_asc', currency: 'USD' }))?.currency, 'USD');
});

test('decimal money conversion is exact for USD, JPY and KWD; invalid bounds/precision are rejected', () => {
  assert.equal(decimalToMinor('0.29', 'USD'), 29); assert.equal(decimalToMinor('19.99', 'USD'), 1999);
  assert.equal(decimalToMinor('199', 'JPY'), 199); assert.equal(decimalToMinor('1.001', 'KWD'), 1001);
  assert.equal(minorToDecimal(29, 'USD'), '0.29');
  assert.deepEqual(pricePatch('0', '0.29', 'USD'), { minPrice: '0', maxPrice: '29' });
  for (const value of ['0.001', '1e2', '-1', 'Infinity', '9999999999']) assert.throws(() => decimalToMinor(value, 'USD'));
  assert.throws(() => decimalToMinor('1.1', 'JPY'));
  assert.throws(() => pricePatch('2', '1', 'USD'));
  assert.equal(searchValidation(searchState({ currency: 'USD', maxPrice: '1.5' })), 'invalidPrice');
});

test('active chips and controls display URL-selected filters and human price units', () => {
  const state = searchState({ q: 'Sony', sort: 'price_asc', merchant: 'ebay,aliexpress', category: 'headphones', currency: 'USD', minPrice: '29', maxPrice: '1999' });
  const html = render(<SearchFilters state={state} onChange={() => {}} options={{
    merchants: [{ code: 'ebay', name: 'eBay' }, { code: 'aliexpress', name: 'AliExpress' }],
    categories: [{ id: 'category', slug: 'headphones', name: 'Headphones', parentId: null }], currencies: ['USD'],
  }} />);
  for (const text of ['Active filters', 'eBay', 'AliExpress', 'Headphones', 'Currency', 'USD', '$0.29', '$19.99', 'Clear all filters']) assert.ok(html.includes(text), text);
  assert.ok(html.includes('value="0.29"')); assert.ok(html.includes('value="19.99"'));
  assert.ok(html.includes('value="price_asc" selected=""'));
  assert.equal((html.match(/type="checkbox" checked=""/g) || []).length, 2);
});

test('currency-needed and blank-query states retain sort/filter controls', () => {
  const missingCurrency = render(<SearchResultsView searchParams={{ q: 'headphones', sort: 'price_asc' }} navigate={() => {}} />);
  assert.ok(missingCurrency.includes('Choose a currency to sort or filter by price.'));
  assert.ok(missingCurrency.includes('id="sort"')); assert.ok(!missingCurrency.includes('Loading...'));
  const blank = render(<SearchResultsView searchParams={{}} navigate={() => {}} />);
  assert.ok(blank.includes('Search listings')); assert.ok(blank.includes('id="sort"'));
});

test('request gate aborts previous search/suggestions and rejects late resolutions', async () => {
  const gate = new LatestRequest(); const first = gate.begin(); let finish!: (value: string) => void;
  const old = new Promise<string>(resolve => { finish = resolve; });
  const applied: string[] = [];
  const pending = old.then(value => { if (first.current()) applied.push(value); });
  const second = gate.begin(); assert.equal(first.signal.aborted, true);
  if (second.current()) applied.push('new'); finish('old'); await pending;
  assert.deepEqual(applied, ['new']); gate.cancel(); assert.equal(second.current(), false);
});

test('autocomplete arrow navigation wraps correctly and input declares combobox accessibility', () => {
  assert.equal(suggestionIndex('ArrowDown', -1, 3), 0); assert.equal(suggestionIndex('ArrowDown', 2, 3), 0);
  assert.equal(suggestionIndex('ArrowUp', -1, 3), 2); assert.equal(suggestionIndex('ArrowUp', 0, 3), 2);
  assert.equal(suggestionIndex('ArrowDown', -1, 0), -1);
  const market = { id: 'ge', code: 'GE', name: 'Georgia', locale: 'ka-GE', language: 'ka', currencyCode: 'GEL', currencySymbol: '₾', isActive: true, createdAt: '', updatedAt: '' };
  const html = render(<SearchInput initialQuery="Sony" market={market} onSearch={() => {}} />);
  assert.ok(html.includes('role="combobox"')); assert.ok(html.includes('aria-autocomplete="list"')); assert.ok(html.includes('value="Sony"'));
});

test('search and autocomplete API clients forward cancellation signals', async () => {
  const previous = globalThis.fetch; const signals: (AbortSignal | null | undefined)[] = [];
  globalThis.fetch = async (_url, options) => { signals.push(options?.signal); return Response.json({ suggestions: [] }); };
  try {
    const controller = new AbortController();
    await api.search.suggestions('Sony', 'GE', controller.signal);
    await api.search.products({ q: 'Sony', market: 'GE' }, controller.signal);
    assert.deepEqual(signals, [controller.signal, controller.signal]);
  } finally { globalThis.fetch = previous; }
});
