'use client';

import { ProductDetailContent } from '@/components/ProductDetailContent';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import type { Market, ProductWithOffers } from '@/types';

const MOCK_MARKETS = [
  { id: '1', code: 'GE', name: 'Georgia', locale: 'ka-GE', language: 'ka', currencyCode: 'GEL', currencySymbol: '₾', isActive: true, createdAt: '', updatedAt: '' },
  { id: '2', code: 'AM', name: 'Armenia', locale: 'hy-AM', language: 'hy', currencyCode: 'AMD', currencySymbol: '֏', isActive: true, createdAt: '', updatedAt: '' },
  { id: '3', code: 'AZ', name: 'Azerbaijan', locale: 'az-AZ', language: 'az', currencyCode: 'AZN', currencySymbol: '₼', isActive: true, createdAt: '', updatedAt: '' },
];

export default function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ market?: string }> }) {
  const { t } = useI18n();
  const [markets] = useState<typeof MOCK_MARKETS>([
    { id: '1', code: 'GE', name: 'Georgia', locale: 'ka-GE', language: 'ka', currencyCode: 'GEL', currencySymbol: '₾', isActive: true, createdAt: '', updatedAt: '' },
    { id: '2', code: 'AM', name: 'Armenia', locale: 'hy-AM', language: 'hy', currencyCode: 'AMD', currencySymbol: '֏', isActive: true, createdAt: '', updatedAt: '' },
    { id: '3', code: 'AZ', name: 'Azerbaijan', locale: 'az-AZ', language: 'az', currencyCode: 'AZN', currencySymbol: '₼', isActive: true, createdAt: '', updatedAt: '' },
  ]);
  const [selectedMarket, setSelectedMarket] = useState<Market>(MOCK_MARKETS[0]);
  const [product, setProduct] = useState<ProductWithOffers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { id } = await params;
        const { market } = await searchParams;
        const marketCode = market || 'GE';

        const marketEntity = markets.find((m) => m.code === marketCode) || markets[0];
        setSelectedMarket(marketEntity);

        const data = await api.products.get(id, marketCode);
        setProduct(data);
        setError(null);
      } catch (err) {
        setError(t('common.productNotFound'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [params, searchParams, markets, t, retry]);

  const handleMarketChange = (market: Market) => {
    setSelectedMarket(market);
    (async () => {
      try {
        setLoading(true);
        const { id } = await params;
        const data = await api.products.get(id, market.code);
        setProduct(data);
        setError(null);
      } catch (err) {
        setError(t('common.failedToLoad'));
      } finally {
        setLoading(false);
      }
    })();
  };

  if (loading) {
    return (
      <div className="byb-commerce product-shell flex min-h-screen flex-col">
        <Header markets={markets} selectedMarket={selectedMarket} onMarketChange={handleMarketChange} />
        <main className="product-detail flex-1">
          <div className="byb-container">
            <div className="product-loading-layout" role="status" aria-busy="true">
              <span className="sr-only">{t('common.loading')}</span>
              <div className="product-loading-gallery" aria-hidden="true" />
              <div className="product-loading-copy" aria-hidden="true">
                <span /><span /><span /><span />
              </div>
            </div>
          </div>
        </main>
        <Footer market={selectedMarket.code} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="byb-commerce product-shell flex min-h-screen flex-col">
        <Header markets={markets} selectedMarket={selectedMarket} onMarketChange={handleMarketChange} />
        <main className="product-detail flex-1">
          <div className="byb-container">
            <div className="commerce-state" role="alert">
              <span className="commerce-state-icon" aria-hidden="true">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              <h1>{t('common.productNotFound')}</h1>
              <p>{error || t('common.failedToLoad')}</p>
              <div className="commerce-state-actions">
                <button type="button" className="btn-primary" onClick={() => setRetry(value => value + 1)}>{t('common.retry')}</button>
                <Link href={`/search?market=${selectedMarket.code}`} className="btn-secondary">
                  {t('common.backToSearch')}
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer market={selectedMarket.code} />
      </div>
    );
  }

  return (
    <div className="byb-commerce product-shell flex min-h-screen flex-col">
      <Header markets={markets} selectedMarket={selectedMarket} onMarketChange={handleMarketChange} />
      <ProductDetailContent product={product} market={selectedMarket} />
      <Footer market={selectedMarket.code} />
    </div>
  );
}
