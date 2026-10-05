'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SearchInput } from '@/components/SearchInput';
import { ProductSection } from '@/components/ProductSection';
import { ProductCard } from '@/components/ProductCard';
import { Hero } from '@/components/Hero';
import { ExploreSection } from '@/components/ExploreSection';
import { DiscoverySections } from '@/components/DiscoverySections';
import { MarketSection } from '@/components/MarketSection';
import { MarketAware } from '@/components/MarketAware';
import { api, formatPrice } from '@/lib/api';
import type { Market, ProductWithOffers } from '@/types';

const MOCK_MARKETS: Market[] = [
  { id: '1', code: 'GE', name: 'Georgia', locale: 'ka-GE', language: 'ka', currencyCode: 'GEL', currencySymbol: '₾', isActive: true, createdAt: '', updatedAt: '' },
  { id: '2', code: 'AM', name: 'Armenia', locale: 'hy-AM', language: 'hy', currencyCode: 'AMD', currencySymbol: '֏', isActive: true, createdAt: '', updatedAt: '' },
  { id: '3', code: 'AZ', name: 'Azerbaijan', locale: 'az-AZ', language: 'az', currencyCode: 'AZN', currencySymbol: '₼', isActive: true, createdAt: '', updatedAt: '' },
];

export default function HomePage() {
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
          api.search.products({ ...baseParams, sort: 'price_asc' }),
          api.search.products({ ...baseParams, sort: 'newest' }),
          api.search.products({ ...baseParams, q: 'limited', sort: 'relevance' }),
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

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header markets={markets} selectedMarket={selectedMarket} onMarketChange={handleMarketChange} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
            <p className="text-gray-600">Loading BYB...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header markets={markets} selectedMarket={selectedMarket} onMarketChange={handleMarketChange} />
      <main className="flex-1">
        <MarketAware>
          {(market) => (
            <>
              <Hero market={market} onSearch={handleSearch} />
              
              {error && (
                <div className="container py-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm" role="alert">
                    {error}
                  </div>
                </div>
              )}

              <ExploreSection markets={MOCK_MARKETS} />
              
              <DiscoverySections
                trendingProducts={trendingProducts}
                popularProducts={popularProducts}
                dealsProducts={dealsProducts}
                newProducts={newProducts}
                rareProducts={rareProducts}
                market={market}
                onProductClick={handleProductClick}
                loading={loading}
              />

              <MarketSection market={market} />
            </>
          )}
        </MarketAware>
      </main>
      <Footer />
    </div>
  );
}