'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SearchInput } from '@/components/SearchInput';
import { ProductCard } from '@/components/ProductCard';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import type { Market, ProductWithOffers, SearchResult } from '@/types';

const MOCK_MARKETS: Market[] = [
  { id: '1', code: 'GE', name: 'Georgia', locale: 'ka-GE', language: 'ka', currencyCode: 'GEL', currencySymbol: '₾', isActive: true, createdAt: '', updatedAt: '' },
  { id: '2', code: 'AM', name: 'Armenia', locale: 'hy-AM', language: 'hy', currencyCode: 'AMD', currencySymbol: '֏', isActive: true, createdAt: '', updatedAt: '' },
  { id: '3', code: 'AZ', name: 'Azerbaijan', locale: 'az-AZ', language: 'az', currencyCode: 'AZN', currencySymbol: '₼', isActive: true, createdAt: '', updatedAt: '' },
];

export default function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; market?: string; page?: string; sort?: string }> }) {
  const { t } = useI18n();
  const [markets] = useState<Market[]>(MOCK_MARKETS);
  const [selectedMarket, setSelectedMarket] = useState<Market>(MOCK_MARKETS[0]);
  const [products, setProducts] = useState<ProductWithOffers[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'relevance' | 'price_asc' | 'price_desc' | 'newest'>('relevance');

  const fetchResults = useCallback(async (searchQuery: string, marketCode: string, pageNum: number, sortBy: string) => {
    try {
      setLoading(true);
      const params = {
        q: searchQuery,
        market: marketCode,
        page: pageNum,
        limit: 20,
        sort: sortBy,
      };
      const data: SearchResult = await api.search.products(params);
      setProducts(data.products);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err) {
      setError(t('common.failedToLoad'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    (async () => {
      const params = await searchParams;
      const searchQuery = params.q || '';
      const marketCode = params.market || 'GE';
      const pageNum = parseInt(params.page || '1', 10);
      const sortBy = (params.sort as typeof sort) || 'relevance';

      const market = markets.find((m) => m.code === marketCode) || markets[0];
      setSelectedMarket(market);
      setQuery(searchQuery);
      setSort(sortBy);
      await fetchResults(searchQuery, marketCode, pageNum, sortBy);
    })();
  }, [searchParams, markets, fetchResults]);

  const handleSearch = (newQuery: string) => {
    setQuery(newQuery);
    fetchResults(newQuery, selectedMarket.code, 1, sort);
  };

  const handleMarketChange = (market: Market) => {
    setSelectedMarket(market);
    fetchResults(query, market.code, 1, sort);
  };

  const handleSortChange = (newSort: typeof sort) => {
    setSort(newSort);
    fetchResults(query, selectedMarket.code, 1, newSort);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchResults(query, selectedMarket.code, newPage, sort);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header markets={markets} selectedMarket={selectedMarket} onMarketChange={handleMarketChange} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
            <p className="text-gray-600">{t('common.loading')}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header markets={markets} selectedMarket={selectedMarket} onMarketChange={handleMarketChange} />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8">
            <SearchInput market={selectedMarket} onSearch={handleSearch} placeholder={t('common.searchPlaceholder')} />
            {query && (
              <p className="mt-4 text-sm text-gray-600">
                {t('search.showingResults', { count: products.length, total, query })}
              </p>
            )}
          </div>

          {error && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm" role="alert">
              {error}
            </div>
          )}

          {!error && products.length === 0 && !loading && (
            <div className="text-center py-16">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('search.noResults')}</h2>
              <p className="text-gray-600 mb-6">{t('search.tryAdjusting')}</p>
              <button
                onClick={() => handleSearch('')}
                className="btn-secondary"
              >
                {t('search.clearSearch')}
              </button>
            </div>
          )}

          {products.length > 0 && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <label htmlFor="sort" className="text-sm text-gray-600">{t('search.sortBy')}</label>
                  <select
                    id="sort"
                    value={sort}
                    onChange={(e) => handleSortChange(e.target.value as typeof sort)}
                    className="input w-auto"
                  >
                    <option value="relevance">{t('search.relevance')}</option>
                    <option value="price_asc">{t('search.priceAsc')}</option>
                    <option value="price_desc">{t('search.priceDesc')}</option>
                    <option value="newest">{t('search.newest')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} market={selectedMarket} onClick={(p) => {
                    window.location.href = `/product/${p.id}?market=${selectedMarket.code}`;
                  }} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={t('search.previous')}
                  >
                    {t('search.previous')}
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600">
                    {t('search.pageOf', { page, totalPages })}
                  </span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={t('search.next')}
                  >
                    {t('search.next')}
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}