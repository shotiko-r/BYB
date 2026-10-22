'use client';

import { ProductImage } from '@/components/ProductImage';
import { knownText } from '@/lib/product-presentation';
import { ProductOfferSummary } from '@/components/ProductOfferSummary';
import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProductComparison } from '@/components/ProductComparison';
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
        setError(t('product.productNotFound'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [params, searchParams, markets, t]);

  const handleMarketChange = (market: Market) => {
    setSelectedMarket(market);
    (async () => {
      try {
        setLoading(true);
        const { id } = await params;
        const data = await api.products.get(id, market.code);
        setProduct(data);
      } catch (err) {
        setError(t('product.failedToLoad'));
      } finally {
        setLoading(false);
      }
    })();
  };

  if (loading) {
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

  if (error || !product) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header markets={markets} selectedMarket={selectedMarket} onMarketChange={handleMarketChange} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('product.productNotFound')}</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <a href={`/search?market=${selectedMarket.code}`} className="btn-primary">
              {t('common.backToSearch')}
            </a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const brand = knownText(product.brand);
  const model = knownText(product.model);

  return (
    <div className="flex flex-col min-h-screen">
      <Header markets={markets} selectedMarket={selectedMarket} onMarketChange={handleMarketChange} />
      <main className="flex-1 py-8">
        <div className="container">
          <nav className="mb-6 text-sm text-gray-500" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2">
              <li><a href={`/?market=${selectedMarket.code}`} className="hover:text-blue-600">{t('product.breadcrumb.home')}</a></li>
              <li className="text-gray-300">/</li>
              <li><a href={`/search?market=${selectedMarket.code}`} className="hover:text-blue-600">{t('product.breadcrumb.search')}</a></li>
              <li className="text-gray-300">/</li>
              <li className="text-gray-900 font-medium truncate max-w-xs" aria-current="page">{product.name}</li>
            </ol>
          </nav>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 min-w-0 space-y-6">
              <article>
                <header className="mb-6">
                  {brand && <p className="text-sm text-gray-500 mb-1">{brand}</p>}
                  <h1 className="text-3xl font-bold text-gray-900 mb-2 break-words">{product.name}</h1>
                  {model && <p className="text-gray-600">{t('product.model', { model })}</p>}
                </header>

                <div className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden mb-6">
                  <ProductImage src={product.imageUrl} alt={product.name} priority sizes="(max-width: 1024px) 100vw, 66vw" />
                </div>

                <ProductComparison product={product} market={selectedMarket} />
              </article>
            </div>

            <aside className="lg:col-span-1">
              <ProductOfferSummary product={product} />
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
