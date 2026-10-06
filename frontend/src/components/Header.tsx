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
  ['discover', '/search'], ['deals', '/deals'],
  ['guides', '/guides'], ['categories', '/categories'],
] as const;

export function Header({ markets, selectedMarket, onMarketChange }: HeaderProps) {
  const { t } = useI18n();
  return (
    <header className="byb-header">
      <div className="byb-container header-inner">
        <Link href="/" aria-label="BYB — Before You Buy"><Logo /></Link>
        <nav className="header-nav" aria-label={t('header.nav.discover')}>
          {navigation.map(([key, href]) => (
            <Link key={key} href={href}>{t(`header.nav.${key}`)}</Link>
          ))}
        </nav>
        <div className="header-utilities">
          <MarketSelector markets={markets} selectedMarket={selectedMarket} onSelect={onMarketChange} />
          <LanguageSelector />
          <ThemeSelector />
        </div>
      </div>
    </header>
  );
}
