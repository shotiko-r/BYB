'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';
import { HomeCommitments } from '@/components/HomeCommitments';
import { ExploreSection } from '@/components/ExploreSection';
import { DiscoverySections } from '@/components/DiscoverySections';
import { MerchantSources } from '@/components/MerchantSources';
import { TrustSection } from '@/components/TrustSection';
import { api } from '@/lib/api';
import { homepageSections } from '@/lib/homepage-sections';
import { selectLedgerProduct } from '@/lib/ledger-preview';
import { useNavigationMarket } from '@/lib/use-navigation-market';
import { navigationMarkets as MOCK_MARKETS } from '@/lib/navigation-markets';
import type { Market, ProductWithOffers } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [markets] = useState<Market[]>(MOCK_MARKETS);
  const [selectedMarket, setSelectedMarket] = useNavigationMarket();
  const [productsBySection, setProductsBySection] = useState<Record<string, ProductWithOffers[]>>({});
  const [unavailableSections, setUnavailableSections] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrichedPreview, setEnrichedPreview] = useState<{ market: string; id: string; product: ProductWithOffers } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchData() {
      setLoading(true);
      setProductsBySection({});
      setUnavailableSections([]);
      setEnrichedPreview(null);
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

  const visibleProducts = useMemo(() => homepageSections.flatMap(section => productsBySection[section.key] ?? []),
    [productsBySection]);
  const previewCandidate = useMemo(() => selectLedgerProduct(productsBySection, homepageSections.map(section => section.key)),
    [productsBySection]);

  useEffect(() => {
    if (!previewCandidate) return;
    let active = true;
    const market = selectedMarket.code;
    void api.products.get(previewCandidate.id, market).then(product => {
      if (active) setEnrichedPreview({ market, id: previewCandidate.id, product });
    }).catch(() => { /* Discovery data remains usable without optional shipping detail. */ });
    return () => { active = false; };
  }, [previewCandidate, selectedMarket.code]);

  const ledgerProduct = previewCandidate && enrichedPreview?.market === selectedMarket.code
    && enrichedPreview.id === previewCandidate.id ? enrichedPreview.product : previewCandidate;

  const handleProductClick = (product: ProductWithOffers) => {
    router.push(`/product/${product.id}?market=${selectedMarket.code}`);
  };

  const handleMarketChange = (market: Market) => {
    setSelectedMarket(market);
  };

  return (
    <div className="byb-home flex flex-col min-h-screen">
      <Header markets={markets} selectedMarket={selectedMarket} onMarketChange={handleMarketChange} />
      <main className="flex-1">
        <Hero market={selectedMarket} previewProduct={ledgerProduct} previewLoading={loading} />
        <HomeCommitments />
        <ExploreSection market={selectedMarket.code} products={visibleProducts} />
        <DiscoverySections
          productsBySection={productsBySection}
          market={selectedMarket}
          onProductClick={handleProductClick}
          loading={loading}
          failed={Boolean(error)}
          unavailableSections={unavailableSections}
          onRetry={() => setRetryCount(count => count + 1)}
        />
        <MerchantSources market={selectedMarket.code} />
        <TrustSection market={selectedMarket.code} />
      </main>
      <Footer market={selectedMarket.code} />
    </div>
  );
}
