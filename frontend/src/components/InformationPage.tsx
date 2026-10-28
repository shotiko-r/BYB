'use client';

import { createContext, useContext, type ReactNode } from 'react';
import NextLink from 'next/link';
import { useNavigationMarket } from '@/lib/use-navigation-market';
import { Header } from './Header';
import { Footer } from './Footer';
import { navigationMarkets } from '@/lib/navigation-markets';

const InformationMarket = createContext('GE');

export function InformationLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const market = useContext(InformationMarket);
  return <NextLink href={`${href}?market=${encodeURIComponent(market)}`} className={className}>{children}</NextLink>;
}

export function InformationPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const [market, setMarket] = useNavigationMarket();
  return <div className="byb-home flex min-h-screen flex-col">
    <Header markets={navigationMarkets} selectedMarket={market} onMarketChange={setMarket} />
    <main className="information-page byb-container"><p className="information-eyebrow">Before You Buy</p><h1>{title}</h1><p className="information-intro">{intro}</p><InformationMarket.Provider value={market.code}><div className="information-content">{children}</div></InformationMarket.Provider></main>
    <Footer market={market.code} />
  </div>;
}
