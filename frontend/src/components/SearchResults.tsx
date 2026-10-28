'use client';

import { useState, useEffect, useMemo, useRef, useTransition } from 'react';
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
  return <div className="flex flex-col min-h-screen">
    <Header markets={MARKETS} selectedMarket={selectedMarket} onMarketChange={market => change({ market: market.code })} />
    <main className="search-page flex-1"><div className="byb-container">
      <div className="search-page-input">
        <SearchInput key={state.q} initialQuery={state.q} market={selectedMarket} onSearch={q => change({ q })} showModes={false} />
      </div>
      <SearchFilters key={`${state.currency}:${state.minPrice}:${state.maxPrice}`} state={state} options={options} onChange={change} pending={pending} />
      {catalog?.market === state.market && catalog.error && <div role="alert" className="mb-4 text-sm text-gray-700">
        {t('search.optionsError')} <button type="button" className="underline" onClick={() => setCatalogRetry(value => value + 1)}>{t('common.retry')}</button>
      </div>}
      {validation && <p role="alert" className="mb-4 rounded-lg bg-yellow-50 p-4 text-yellow-800">{t(`search.${validation}`)}</p>}
      {loading && <p role="status" className="mb-4 text-gray-600">{t('common.loading')}</p>}
      {error && <div role="alert" className="mb-4 rounded-lg bg-yellow-50 p-4 text-yellow-800">
        <p>{t('search.requestError')}</p><button type="button" className="btn-secondary mt-2" onClick={() => setRetry(value => value + 1)}>{t('common.retry')}</button>
      </div>}
      {!state.q && <div className="py-12 text-center"><h1 className="text-xl font-semibold">{t('search.startSearch')}</h1><p className="mt-2 text-gray-600">{t('search.enterQuery')}</p></div>}
      {data && <>
        <p role="status" className="search-result-count">{t('search.bybResults', { count: data.products.length, total: data.total, query: state.q })}</p>
        {data.products.length === 0 && <div className="py-12 text-center">
          <h2 className="text-xl font-semibold">{t('search.noResults')}</h2><p className="mt-2 text-gray-600">{t('search.tryAdjusting')}</p>
          <button type="button" className="btn-secondary mt-4" onClick={() => change({ q: '' })}>{t('search.clearSearch')}</button>
        </div>}
        <div className="search-product-grid">
          {data.products.map(product => <ProductCard key={product.id} product={product} market={selectedMarket}
            onClick={() => openProduct(`/product/${product.id}?market=${state.market}`)} />)}
        </div>
        {data.totalPages > 1 && <nav aria-label="Pagination" className="flex justify-center items-center gap-3">
          <button type="button" className="btn-secondary" disabled={state.page <= 1 || pending} onClick={() => change({ page: state.page - 1 })}>{t('search.previous')}</button>
          <span>{t('search.pageOf', { page: state.page, totalPages: data.totalPages })}</span>
          <button type="button" className="btn-secondary" disabled={state.page >= data.totalPages || pending} onClick={() => change({ page: state.page + 1 })}>{t('search.next')}</button>
        </nav>}
      </>}
    </div></main><Footer market={selectedMarket.code} />
  </div>;
}
