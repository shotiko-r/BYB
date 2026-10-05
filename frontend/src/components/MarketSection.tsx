'use client';

import { useI18n } from '@/i18n/I18nContext';

interface MarketSectionProps {
  market: any;
}

export function MarketSection({ market }: MarketSectionProps) {
  const { t } = useI18n();

  if (!market) return null;

  return (
    <section className="section bg-gradient-to-b from-blue-50 to-white" aria-labelledby="market-heading">
      <div className="container">
        <header className="text-center mb-10">
          <h2 id="market-heading" className="text-2xl font-bold text-gray-900">
            {t('homepage.market.shoppingFrom', { market: market.name })}
          </h2>
          <p className="text-gray-600 mt-2 max-w-xl mx-auto">
            {t('homepage.market.delivery')} • {t('homepage.market.localAvailability')} • {t('homepage.market.currency')} • {t('homepage.market.customs')}
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7l8 4" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('homepage.market.delivery')}</h3>
            <p className="text-gray-600 text-sm">Fast delivery across {market.name}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('homepage.market.localAvailability')}</h3>
            <p className="text-gray-600 text-sm">Check local store availability</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.105 0 2.48.313 3.356.909a1.998 1.998 0 01.93 2.693l-4.729 4.729a6 6 0 001.02 1.02L19.87 19.87a2.5 2.5 0 01-3.53 3.53l-2.56-2.56a4.5 4.5 0 00-6.364-6.364L2.7 5.7A1.998 1.998 0 012.7.7l-2.22 2.22A1.998 1.998 0 00.7 5.586l2.56 2.561a4.5 4.5 0 000 6.364L13.3 17.3a2.5 2.5 0 003.53 3.53l2.56 2.56a1.998 1.998 0 002.83 0l2.56-2.56a1.998 1.998 0 000-2.829l-1.574-1.574a1.998 1.998 0 000-2.829z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('homepage.market.currency')}</h3>
            <p className="text-gray-600 text-sm">Prices in {market.currencyCode} ({market.currencySymbol})</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-5.994 9.258l-6.618 6.619a1.998 1.998 0 01-2.827 0l-6.618-6.619a1.998 1.998 0 012.827-2.827l7.835-7.835a1.998 1.998 0 012.828 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('homepage.market.customs')}</h3>
            <p className="text-gray-600 text-sm">Check customs regulations for {market.name}</p>
          </div>
        </div>
      </div>
    </section>
  );
}