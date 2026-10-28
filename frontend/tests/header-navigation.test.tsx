import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync } from 'node:fs';
import { Header } from '../src/components/Header';
import { Footer } from '../src/components/Footer';
import { I18nProvider } from '../src/i18n/I18nContext';
import { homepageCategories, categoryQuickLinks, querySearchHref } from '../src/lib/homepage-categories';
import { searchState, requestForState } from '../src/lib/search-presentation';
import type { Market } from '../src/types';

const market = { id: 'ge', code: 'GE', name: 'Georgia', currencyCode: 'GEL', currencySymbol: '₾' } as Market;
const render = (view: React.ReactNode) => renderToStaticMarkup(<I18nProvider>{view}</I18nProvider>);

test('header search and disclosures expose semantic controls and preserve market', () => {
  const html = render(<Header markets={[market]} selectedMarket={market} onMarketChange={() => {}} />);
  for (const text of ['class="header-search"', 'action="/search"', 'method="get"', 'name="q"', 'name="market" value="GE"', 'href="/search?market=GE"', 'aria-label="Open navigation menu"', 'class="header-mobile-panel"']) assert.ok(html.includes(text), text);
  for (const name of ['discover', 'categories', 'mobile']) {
    assert.ok(html.includes(`aria-expanded="false" aria-controls="nav-${name}"`));
    assert.ok(html.includes(`id="nav-${name}"`));
  }
});

test('all header and footer destinations resolve to implemented routes and valid homepage anchors', () => {
  const html = render(<><Header markets={[market]} selectedMarket={market} onMarketChange={() => {}} /><Footer /></>);
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const url = new URL(match[1].replaceAll('&amp;', '&'), 'https://byb.example');
    assert.ok(existsSync(`src/app${url.pathname === '/' ? '' : url.pathname}/page.tsx`), url.pathname);
    assert.equal(url.searchParams.get('market'), 'GE');
    if (url.hash) assert.ok(['#explore', '#discovery'].includes(url.hash));
    assert.ok(!['/deals', '/account', '/cart', '/favorites', '/trending'].includes(url.pathname));
  }
});

test('all curated quick links use shared controlled queries and preserve GE/AM/AZ', () => {
  assert.equal(homepageCategories.length, 8);
  for (const category of homepageCategories) for (const [, query] of categoryQuickLinks[category.id]) for (const market of ['GE', 'AM', 'AZ']) {
    const url = new URL(querySearchHref(query, market), 'https://byb.example');
    const request = requestForState(searchState(Object.fromEntries(url.searchParams)));
    assert.equal(request?.q, query); assert.equal(request?.market, market); assert.equal(request?.category, undefined);
  }
});

test('Discover price links use USD minor units and valid search behavior', () => {
  const html = render(<Header markets={[market]} selectedMarket={market} onMarketChange={() => {}} />);
  for (const price of ['2500', '5000']) {
    const match = [...html.matchAll(/href="([^"]+)"/g)].find(match => match[1].includes(`maxPrice=${price}`));
    assert.ok(match);
    const url = new URL(match[1].replaceAll('&amp;', '&'), 'https://byb.example');
    const request = requestForState(searchState(Object.fromEntries(url.searchParams)));
    assert.equal(request?.maxPrice, price); assert.equal(request?.currency, 'USD');
  }
});

test('public information routes render factual content without a pretend contact form', async () => {
  for (const route of ['about', 'how-it-works', 'partners', 'affiliate-disclosure', 'contact']) {
    const { default: Page } = await import(`../src/app/${route}/page`);
    const html = render(<Page />);
    assert.ok(html.includes('<h1>')); assert.ok(html.includes('<footer'));
    if (route === 'contact') { assert.ok(html.includes('Contact form coming soon')); assert.ok(!html.includes('type="email"')); }
  }
});
