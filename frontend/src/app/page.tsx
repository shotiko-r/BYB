'use client';

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
  const [markets] = useState<Market[]>(MOCK_MARKETS);
  const [selectedMarket, setSelectedMarket] = useState<Market>(MOCK_MARKETS[0]);
  const [productsBySection, setProductsBySection] = useState<Record<string, ProductWithOffers[]>>({});
  const [unavailableSections, setUnavailableSections] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchData() {
      setLoading(true);
      setProductsBySection({});
      setUnavailableSections([]);
      setError(null);
      try {
        const result = await api.discovery.home(selectedMarket.code, controller.signal);
        if (controller.signal.aborted) return;
        setProductsBySection(Object.fromEntries(result.sections.map(section => [section.key, section.products])));
        setUnavailableSections(result.sections.filter(section => section.status === 'unavailable').map(section => section.key));
      } catch {
        if (!controller.signal.aborted) setError('discovery');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void fetchData();
    return () => controller.abort();
  }, [selectedMarket.code, retryCount]);

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
        <ExploreSection />
        <DiscoverySections
          productsBySection={productsBySection}
          market={selectedMarket}
          onProductClick={handleProductClick}
          loading={loading}
          failed={Boolean(error)}
          unavailableSections={unavailableSections}
          onRetry={() => setRetryCount(count => count + 1)}
        />
        <MarketSection market={selectedMarket} />
      </main>
      <Footer />
    </div>
  );
}