'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProductComparison } from '@/components/ProductComparison';
import { api, formatPrice } from '@/lib/api';
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

  const bestOffer = product.offers[0];
  const isExternalProductImage = product.imageUrl?.startsWith('http');

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
            <div className="lg:col-span-2 space-y-6">
              <article>
                <header className="mb-6">
                  {product.brand && <p className="text-sm text-gray-500 mb-1">{product.brand}</p>}
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
                  {product.model && <p className="text-gray-600">{t('product.model', { model: product.model })}</p>}
                </header>

                <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden mb-6">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                      priority
                      sizes="(max-width: 1024px) 100vw, 66vw"
                      unoptimized={product.imageUrl?.startsWith('http')}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                <ProductComparison product={product} market={selectedMarket} />
              </article>
            </div>

            <aside className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('product.bestOffer')}</h2>
                  {bestOffer && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        {bestOffer.merchant?.logoUrl && (
                          <Image
                            src={bestOffer.merchant.logoUrl}
                            alt={bestOffer.merchant.name}
                            width={40}
                            height={40}
                            className="object-contain rounded bg-gray-50 p-1"
                            unoptimized={bestOffer.merchant.logoUrl?.startsWith('http')}
                          />
                        )}
                        <div>
                          <p className="font-medium">{bestOffer.merchant?.name}</p>
                          <p className="text-sm text-gray-500">{bestOffer.availability === 'in_stock' ? t('product.availability.in_stock') : bestOffer.availability}</p>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-gray-900">
                        {formatPrice(bestOffer.priceAmount, selectedMarket.currencyCode, selectedMarket.currencySymbol)}
                      </div>
                      <a
                        href={bestOffer.destinationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary w-full"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {t('product.buyOn', { merchant: bestOffer.merchant?.name || '' })}
                      </a>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('product.allOffers', { count: product.offers.length })}</h2>
                  <ul className="space-y-3">
                    {product.offers.slice(0, 5).map((offer) => (
                      <li key={offer.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {offer.merchant?.logoUrl && (
                            <Image
                              src={offer.merchant.logoUrl}
                              alt=""
                              width={24}
                              height={24}
                              className="object-contain rounded bg-gray-100 p-0.5 flex-shrink-0"
                              unoptimized={offer.merchant.logoUrl?.startsWith('http')}
                            />
                          )}
                          <span className="text-sm font-medium truncate">{offer.merchant?.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-gray-900">
                            {formatPrice(offer.priceAmount, selectedMarket.currencyCode, selectedMarket.currencySymbol)}
                          </p>
                          <p className="text-xs text-gray-500">{offer.availability}</p>
                        </div>
                      </li>
                    ))}
                    {product.offers.length > 5 && (
                      <li className="text-center pt-2">
                        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                          {t('product.viewAllOffers', { count: product.offers.length })}
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}