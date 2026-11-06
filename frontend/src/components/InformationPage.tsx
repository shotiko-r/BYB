'use client';

import { createContext, useContext, type ReactNode } from 'react';
import NextLink from 'next/link';
import { useNavigationMarket } from '@/lib/use-navigation-market';
import { useI18n } from '@/i18n/I18nContext';
import { Header } from './Header';
import { Footer } from './Footer';
import { navigationMarkets } from '@/lib/navigation-markets';

const InformationMarket = createContext('GE');

export function InformationLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const market = useContext(InformationMarket);
  return <NextLink href={`${href}?market=${encodeURIComponent(market)}`} className={className}>{children}</NextLink>;
}

export function InformationPage({ title, intro, eyebrow, children }: {
  title: string; intro: string; eyebrow?: string; children: ReactNode;
}) {
  const [market, setMarket] = useNavigationMarket();
  const { t } = useI18n();
  return <div className="byb-commerce information-shell flex min-h-screen flex-col">
    <Header markets={navigationMarkets} selectedMarket={market} onMarketChange={setMarket} />
    <main className="information-page flex-1">
      <section className="information-hero">
        <div className="byb-container information-hero-inner">
          <p className="information-eyebrow">{eyebrow ?? t('information.common.eyebrow')}</p>
          <h1>{title}</h1>
          <p className="information-intro">{intro}</p>
        </div>
      </section>
      <div className="byb-container information-body">
        <InformationMarket.Provider value={market.code}>
          <div className="information-content">{children}</div>
        </InformationMarket.Provider>
      </div>
    </main>
    <Footer market={market.code} />
  </div>;
}
