'use client';

import { useState, useEffect, useMemo, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SearchOptions } from '@byb/shared';
import { searchState, searchHref, searchValidation, requestForState, type SearchPageParams, type SearchState } from '@/lib/search-presentation';
import { LatestRequest } from '@/lib/latest-request';
import { Header } from './Header';
import { Footer } from './Footer';
import { SearchInput } from './SearchInput';
import { SearchFilters } from './SearchFilters';
import { ProductCard } from './ProductCard';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import type { Market, SearchResult } from '@/types';

const MARKETS: Market[] = [
  { id: '1', code: 'GE', name: 'Georgia', locale: 'ka-GE', language: 'ka', currencyCode: 'GEL', currencySymbol: '₾', isActive: true, createdAt: '', updatedAt: '' },
  { id: '2', code: 'AM', name: 'Armenia', locale: 'hy-AM', language: 'hy', currencyCode: 'AMD', currencySymbol: '֏', isActive: true, createdAt: '', updatedAt: '' },
  { id: '3', code: 'AZ', name: 'Azerbaijan', locale: 'az-AZ', language: 'az', currencyCode: 'AZN', currencySymbol: '₼', isActive: true, createdAt: '', updatedAt: '' },
];

export function SearchResults({ searchParams }: { searchParams: SearchPageParams }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <SearchResultsView searchParams={searchParams} pending={pending}
    navigate={href => startTransition(() => router.push(href, { scroll: false }))} openProduct={href => router.push(href)} />;
}

// All applied query/filter/page state is derived from Next's resolved URL props.
export function SearchResultsView({ searchParams, navigate, openProduct = navigate, pending = false }: {
  searchParams: SearchPageParams; navigate: (href: string) => void; openProduct?: (href: string) => void; pending?: boolean;
}) {
  const { t } = useI18n();
  const state = useMemo(() => searchState(searchParams), [searchParams]);
  const key = searchHref(state, { page: state.page });
  const validation = searchParams.currency && searchParams.currencyCode && searchParams.currency !== searchParams.currencyCode ? 'invalidCurrency' : searchValidation(state);
  const selectedMarket = MARKETS.find(market => market.code === state.market) || MARKETS[0];
  const latest = useRef(new LatestRequest());
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState<{ key: string; data?: SearchResult; error?: boolean; loading: boolean }>();
  const [catalog, setCatalog] = useState<{ market: string; options?: SearchOptions; error?: boolean }>();
  const [catalogRetry, setCatalogRetry] = useState(0);

  useEffect(() => {
    const gate = latest.current;
    const request = gate.begin();
    const params = requestForState(state);
    if (params && !validation) {
      void (async () => {
        setSnapshot({ key, loading: true });
        try {
          const data = await api.search.products(params, request.signal);
          if (request.current()) setSnapshot({ key, data, loading: false });
        } catch {
          if (request.current()) setSnapshot({ key, error: true, loading: false });
        }
      })();
    }
    return () => gate.cancel();
  }, [state, key, validation, retry]);

  useEffect(() => {
    const controller = new AbortController();
    void api.search.options(state.market, controller.signal).then(options => {
      if (!controller.signal.aborted) setCatalog({ market: state.market, options });
    }).catch(() => {
      if (!controller.signal.aborted) setCatalog({ market: state.market, error: true });
    });
    return () => controller.abort();
  }, [state.market, catalogRetry]);

  const current = snapshot?.key === key ? snapshot : undefined;
  const data = !validation && state.q ? current?.data : undefined;
  const loading = Boolean(state.q && !validation && (!current || current.loading));
  const error = !validation && state.q && current?.error;
  const options = catalog?.market === state.market ? catalog.options : undefined;
  const change = (patch: Partial<SearchState>) => navigate(searchHref(state, patch));
  return <div className="byb-commerce search-shell flex min-h-screen flex-col">
    <Header markets={MARKETS} selectedMarket={selectedMarket} onMarketChange={market => change({ market: market.code })} />
    <main className="search-page flex-1">
      <section className="search-hero" aria-labelledby="search-page-title">
        <div className="byb-container search-hero-inner">
          <div className="search-hero-top">
            <div>
              <p className="eyebrow">{t('search.eyebrow')}</p>
              <h1 id="search-page-title">{state.q ? t('search.resultsFor', { query: state.q }) : t('search.startSearch')}</h1>
              <p className="search-hero-subtitle">{t('search.subtitle')}</p>
            </div>
            <Link className="search-hero-link" href={`/?market=${state.market}`}>
              {t('search.backHome')} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="search-page-input">
            <SearchInput key={state.q} initialQuery={state.q} market={selectedMarket} onSearch={q => change({ q })} showModes={false} />
          </div>
        </div>
      </section>
      <div className="byb-container search-page-body">
        <SearchFilters key={`${state.currency}:${state.minPrice}:${state.maxPrice}`} state={state} options={options} onChange={change} pending={pending} />
        {catalog?.market === state.market && catalog.error && <div role="alert" className="search-inline-error">
          {t('search.optionsError')} <button type="button" className="underline" onClick={() => setCatalogRetry(value => value + 1)}>{t('common.retry')}</button>
        </div>}
        {validation && <p role="alert" className="search-alert">{t(`search.${validation}`)}</p>}
        {loading && <div role="status" aria-live="polite" className="search-loading-state">
          <p className="search-loading-label">{t('common.loading')}</p>
          <div className="search-skeleton-grid" aria-hidden="true">
            {[0, 1, 2, 3].map(item => <div className="product-skeleton" key={item}>
              <div className="product-skeleton-media" />
              <div className="product-skeleton-body">
                <span className="product-skeleton-line is-short" />
                <span className="product-skeleton-line" />
                <span className="product-skeleton-line is-price" />
              </div>
            </div>)}
          </div>
        </div>}
        {error && <div role="alert" className="commerce-state">
          <span className="commerce-state-icon" aria-hidden="true">!</span>
          <h2>{t('search.requestError')}</h2>
          <p>{t('search.tryAdjusting')}</p>
          <div className="commerce-state-actions">
            <button type="button" className="btn-primary" onClick={() => setRetry(value => value + 1)}>{t('common.retry')}</button>
          </div>
        </div>}
        {!state.q && <div className="commerce-state search-empty-state">
          <span className="commerce-state-icon" aria-hidden="true">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" strokeWidth="1.8" /><path d="m20 20-4.2-4.2" strokeLinecap="round" strokeWidth="1.8" /></svg>
          </span>
          <h2>{t('search.startSearch')}</h2>
          <p>{t('search.enterQuery')}</p>
          <div className="commerce-state-actions">
            <Link href={`/?market=${state.market}`} className="btn-primary">{t('search.browseHome')}</Link>
          </div>
        </div>}
        {data && <>
          <div className="search-results-head">
            <p role="status" className="search-result-count">{t('search.bybResults', { count: data.products.length, total: data.total, query: state.q })}</p>
            {data.products.length > 0 && <p className="search-results-note">{t('search.resultsNote')}</p>}
          </div>
          {data.products.length === 0 && <div className="commerce-state search-empty-state">
            <span className="commerce-state-icon" aria-hidden="true">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 7h16M7 4v6m10-6v6M5 11h14l-1.2 8.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 11Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
            </span>
            <h2>{t('search.noResults')}</h2>
            <p>{t('search.tryAdjusting')}</p>
            <div className="commerce-state-actions">
              <button type="button" className="btn-secondary" onClick={() => change({ q: '' })}>{t('search.clearSearch')}</button>
            </div>
          </div>}
          <div className="search-product-grid">
            {data.products.map(product => <ProductCard key={product.id} product={product} market={selectedMarket}
              onClick={() => openProduct(`/product/${product.id}?market=${state.market}`)} />)}
          </div>
          {data.totalPages > 1 && <nav aria-label="Pagination" className="search-pagination">
            <button type="button" className="btn-secondary" disabled={state.page <= 1 || pending} onClick={() => change({ page: state.page - 1 })}>{t('search.previous')}</button>
            <span className="search-pagination-status">{t('search.pageOf', { page: state.page, totalPages: data.totalPages })}</span>
            <button type="button" className="btn-secondary" disabled={state.page >= data.totalPages || pending} onClick={() => change({ page: state.page + 1 })}>{t('search.next')}</button>
          </nav>}
        </>}
      </div>
    </main>
    <Footer market={selectedMarket.code} />
  </div>;
}
