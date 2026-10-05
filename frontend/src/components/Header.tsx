'use client';

import Link from 'next/link';
import { MarketSelector } from './MarketSelector';
import { LanguageSelector } from './LanguageSelector';
import { useI18n } from '@/i18n/I18nContext';
import type { Market } from '@/types';

interface HeaderProps {
  markets: Market[];
  selectedMarket: Market;
  onMarketChange: (market: Market) => void;
}

export function Header({ markets, selectedMarket, onMarketChange }: HeaderProps) {
  const { t } = useI18n();

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2" aria-label={t('common.search')}>
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span className="text-2xl font-bold text-gray-900">BYB</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6" aria-label={t('header.nav.discover')}>
              <Link href="/search" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
                {t('header.nav.discover')}
              </Link>
              <Link href="/deals" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
                {t('header.nav.deals')}
              </Link>
              <Link href="/guides" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
                {t('header.nav.guides')}
              </Link>
              <Link href="/categories" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
                {t('header.nav.categories')}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <MarketSelector markets={markets} selectedMarket={selectedMarket} onSelect={onMarketChange} />
            <LanguageSelector />
          </div>
        </div>
      </div>
    </header>
  );
}