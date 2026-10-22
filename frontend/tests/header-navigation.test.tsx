import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { Header } from '../src/components/Header';
import { Footer } from '../src/components/Footer';
import { I18nProvider } from '../src/i18n/I18nContext';
import type { Market } from '../src/types';

const market = { id: 'ge', code: 'GE', name: 'Georgia', currencyCode: 'GEL', currencySymbol: '₾' } as Market;
const render = (view: React.ReactNode) => renderToStaticMarkup(<I18nProvider>{view}</I18nProvider>);

test('header search uses a real GET destination and keeps the selected market', () => {
  const html = render(<Header markets={[market]} selectedMarket={market} onMarketChange={() => {}} />);
  assert.ok(html.includes('class="header-search"'));
  assert.ok(html.includes('action="/search"'));
  assert.ok(html.includes('method="get"'));
  assert.ok(html.includes('name="q"'));
  assert.ok(html.includes('name="market" value="GE"'));
  assert.ok(html.includes('href="/search?market=GE"'));
  assert.ok(html.includes('aria-label="Open navigation menu"'));
  assert.ok(html.includes('class="header-mobile-panel"'));
});

test('header and footer expose only implemented navigation destinations', () => {
  const html = render(<><Header markets={[market]} selectedMarket={market} onMarketChange={() => {}} /><Footer /></>);
  for (const dead of ['/about', '/blog', '/careers', '/press', '/privacy', '/terms', '/cookies', '/affiliate', '/deals', '/new', '/rare', '/trending', '/categories']) {
    assert.ok(!html.includes(`href="${dead}`), dead);
  }
  for (const live of ['href="/"', 'href="/#explore"', 'href="/search"', 'href="/search?q=headphones&amp;sort=newest"']) {
    assert.ok(html.includes(live), live);
  }
});
