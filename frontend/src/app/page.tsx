'use client';

import { useI18n } from '@/i18n/I18nContext';
import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';
import { ExploreSection } from '@/components/ExploreSection';
import { DiscoverySections } from '@/components/DiscoverySections';
import { MarketSection } from '@/components/MarketSection';
import { api } from '@/lib/api';
import type { Market, ProductWithOffers } from '@/types';

const MOCK_MARKETS: Market[] = [
  { id: '1', code: 'GE', name: 'Georgia', locale: 'ka-GE', language: 'ka', currencyCode: 'GEL', currencySymbol: '₾', isActive: true, createdAt: '', updatedAt: '' },
  { id: '2', code: 'AM', name: 'Armenia', locale: 'hy-AM', language: 'hy', currencyCode: 'AMD', currencySymbol: '֏', isActive: true, createdAt: '', updatedAt: '' },
  { id: '3', code: 'AZ', name: 'Azerbaijan', locale: 'az-AZ', language: 'az', currencyCode: 'AZN', currencySymbol: '₼', isActive: true, createdAt: '', updatedAt: '' },
];

export default function HomePage() {
  const { t } = useI18n();
  const [markets] = useState<Market[]>(MOCK_MARKETS);
  const [selectedMarket, setSelectedMarket] = useState<Market>(MOCK_MARKETS[0]);
  const [trendingProducts, setTrendingProducts] = useState<ProductWithOffers[]>([]);
  const [popularProducts, setPopularProducts] = useState<ProductWithOffers[]>([]);
  const [dealsProducts, setDealsProducts] = useState<ProductWithOffers[]>([]);
  const [newProducts, setNewProducts] = useState<ProductWithOffers[]>([]);
  const [rareProducts, setRareProducts] = useState<ProductWithOffers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const baseParams = {
          market: selectedMarket.code,
          limit: 20,
        };

        const [trending, popular, deals, newest, rare] = await Promise.all([
          api.search.products({ ...baseParams, q: 'headphones', sort: 'relevance' }),
          api.search.products({ ...baseParams, q: 'smartphone', sort: 'relevance' }),
          api.search.products({ ...baseParams, q: 'sony', sort: 'relevance' }),
          api.search.products({ ...baseParams, q: 'wireless', sort: 'relevance' }),
          api.search.products({ ...baseParams, q: 'headphone', sort: 'relevance' }),
        ]);

        setTrendingProducts(trending.products);
        setPopularProducts(popular.products);
        setDealsProducts(deals.products.slice(0, 10));
        setNewProducts(newest.products);
        setRareProducts(rare.products);
        setError(null);
      } catch (err) {
        setError('Failed to load products. Make sure the backend is running.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedMarket.code]);

  const handleSearch = (query: string) => {
    window.location.href = `/search?q=${encodeURIComponent(query)}&market=${selectedMarket.code}`;
  };

  const handleProductClick = (product: ProductWithOffers) => {
    window.location.href = `/product/${product.id}?market=${selectedMarket.code}`;
  };

  const handleMarketChange = (market: Market) => {
    setSelectedMarket(market);
  };

  return (
    <div className="byb-home flex flex-col min-h-screen">
      <Header markets={markets} selectedMarket={selectedMarket} onMarketChange={handleMarketChange} />
      <main className="flex-1">
        <Hero market={selectedMarket} onSearch={handleSearch} />
        {error && (
          <div className="byb-container py-4">
            <div className="homepage-error" role="alert">{t('common.failedToLoad')}</div>
          </div>
        )}
        <ExploreSection />
        <DiscoverySections
          trendingProducts={trendingProducts}
          popularProducts={popularProducts}
          dealsProducts={dealsProducts}
          newProducts={newProducts}
          rareProducts={rareProducts}
          market={selectedMarket}
          onProductClick={handleProductClick}
          loading={loading}
        />
        <MarketSection market={selectedMarket} />
      </main>
      <Footer />
    </div>
  );
}