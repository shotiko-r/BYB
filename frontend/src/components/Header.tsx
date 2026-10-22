'use client';

import Link from 'next/link';
import { MarketSelector } from './MarketSelector';
import { LanguageSelector } from './LanguageSelector';
import { ThemeSelector } from './ThemeProvider';
import { Logo } from './Logo';
import { useI18n } from '@/i18n/I18nContext';
import type { Market } from '@/types';

interface HeaderProps {
  markets: Market[];
  selectedMarket: Market;
  onMarketChange: (market: Market) => void;
}

const navigation = [
  ['discover', '/'], ['categories', '/#explore'],
] as const;

export function Header({ markets, selectedMarket, onMarketChange }: HeaderProps) {
  const { t } = useI18n();
  return (
    <header className="byb-header">
      <div className="byb-container header-inner">
        <Link href="/" aria-label="BYB — Before You Buy"><Logo /></Link>
        <nav className="header-nav" aria-label={t('header.navigation')}>
          {navigation.map(([key, href]) => (
            <Link key={key} href={href}>{t(`header.nav.${key}`)}</Link>
          ))}
        </nav>
        <form className="header-search" action="/search" method="get" role="search" aria-label={t('header.search')}>
          <label className="sr-only" htmlFor="header-search-input">{t('header.search')}</label>
          <input id="header-search-input" type="search" name="q" required maxLength={120}
            autoComplete="off" placeholder={t('search.placeholder')} />
          <input type="hidden" name="market" value={selectedMarket.code} />
          <button type="submit" aria-label={t('header.search')}>
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
            </svg>
          </button>
        </form>
        <div className="header-utilities">
          <MarketSelector markets={markets} selectedMarket={selectedMarket} onSelect={onMarketChange} />
          <LanguageSelector />
          <ThemeSelector />
        </div>
        <div className="header-mobile-actions">
          <Link className="header-icon-action" href={`/search?market=${selectedMarket.code}`} aria-label={t('header.search')}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
            </svg>
          </Link>
          <details className="header-mobile-menu">
            <summary aria-label={t('header.openMenu')}>
              <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <div className="header-mobile-panel">
              <nav aria-label={t('header.navigation')}>
                {navigation.map(([key, href]) => (
                  <Link key={key} href={href}>{t(`header.nav.${key}`)}</Link>
                ))}
              </nav>
              <div className="header-mobile-utilities">
                <MarketSelector markets={markets} selectedMarket={selectedMarket} onSelect={onMarketChange} />
                <LanguageSelector />
                <ThemeSelector />
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
