'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ConciergeSearch } from '@/components/ConciergeSearch';
import { HomeBrowsingMemory } from '@/components/HomeBrowsingMemory';
import { rememberInterest } from '@/lib/local-interests';
import { useI18n } from '@/i18n/I18nContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';
import { ExploreSection } from '@/components/ExploreSection';
import { DiscoverySections } from '@/components/DiscoverySections';
import { MarketSection } from '@/components/MarketSection';
import { api } from '@/lib/api';
import { useNavigationMarket } from '@/lib/use-navigation-market';
import { navigationMarkets as MOCK_MARKETS } from '@/lib/navigation-markets';
import type { Market, ProductWithOffers } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [markets] = useState<Market[]>(MOCK_MARKETS);
  const [selectedMarket, setSelectedMarket] = useNavigationMarket();
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

  const handleProductClick = (product: ProductWithOffers) => {
    rememberInterest({ kind: 'product', id: product.id, market: selectedMarket.code });
    router.push(`/product/${product.id}?market=${selectedMarket.code}`);
  };

  const handleMarketChange = (market: Market) => {
    setSelectedMarket(market);
  };

  return (
    <div className="byb-home flex flex-col min-h-screen">
      <Header markets={markets} selectedMarket={selectedMarket} onMarketChange={handleMarketChange} />
      <main className="flex-1">
        <Hero market={selectedMarket} />
        <ExploreSection market={selectedMarket.code} />
        <DiscoverySections
          productsBySection={productsBySection}
          market={selectedMarket}
          onProductClick={handleProductClick}
          loading={loading}
          failed={Boolean(error)}
          unavailableSections={unavailableSections}
          onRetry={() => setRetryCount(count => count + 1)}
        />
        <section className="home-assistant byb-container">
          <details>
            <summary>{t('homepage.h1.assistant')} <span aria-hidden="true">+</span></summary>
            <ConciergeSearch key={selectedMarket.code} market={selectedMarket} />
          </details>
        </section>
        <HomeBrowsingMemory />
        <MarketSection market={selectedMarket} />
      </main>
      <Footer market={selectedMarket.code} />
    </div>
  );
}
