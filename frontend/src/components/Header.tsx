'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MarketSelector } from './MarketSelector';
import { LanguageSelector } from './LanguageSelector';
import { ThemeSelector } from './ThemeProvider';
import { Logo } from './Logo';
import { useI18n } from '@/i18n/I18nContext';
import { homepageCategories, categoryQuickLinks, categorySearchHref, querySearchHref } from '@/lib/homepage-categories';
import type { Market } from '@/types';

interface HeaderProps {
  markets: Market[];
  selectedMarket: Market;
  onMarketChange: (market: Market) => void;
}

export function Header({ markets, selectedMarket, onMarketChange }: HeaderProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState<'discover' | 'categories' | 'mobile' | null>(null);
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const market = selectedMarket.code;
  const home = `/?market=${market}`;
  const discover = [
    ['Discover', `${home}#discovery`],
    ['New on BYB', `/search?${new URLSearchParams({ q: 'headphones', sort: 'newest', market })}`],
    ['Under US$25', `/search?${new URLSearchParams({ q: 'accessories', currency: 'USD', maxPrice: '2500', market })}`],
    ['Under US$50', `/search?${new URLSearchParams({ q: 'accessories', currency: 'USD', maxPrice: '5000', market })}`],
    ['More to Explore', `${home}#explore`],
  ];
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && open) { setOpen(null); trigger.current?.focus(); } };
    const resize = () => setOpen(null);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', resize); };
  }, [open]);
  const toggle = (name: 'discover' | 'categories' | 'mobile', button: HTMLButtonElement) => { trigger.current = button; setOpen(open === name ? null : name); };
  const utilities = <><MarketSelector markets={markets} selectedMarket={selectedMarket} onSelect={onMarketChange} /><LanguageSelector /><ThemeSelector /></>;
  return (
    <header className="byb-header" ref={root}
      onClick={event => { if ((event.target as Element).closest('a')) setOpen(null); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null); }}>
      <div className="byb-container header-inner">
        <Link href={home} aria-label="BYB — Before You Buy"><Logo /></Link>
        <nav className="header-nav" aria-label={t('header.navigation')}>
          {(['discover', 'categories'] as const).map(name => <button key={name} aria-expanded={open === name} aria-controls={`nav-${name}`} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); trigger.current = event.currentTarget; setOpen(name); requestAnimationFrame(() => document.querySelector<HTMLAnchorElement>(`#nav-${name} a`)?.focus()); } }} onClick={event => toggle(name, event.currentTarget)}>{t(`header.nav.${name}`)} <span aria-hidden="true">⌄</span></button>)}
          <Link href={`/how-it-works?market=${market}`}>How it works</Link>
          <Link href={`/about?market=${market}`}>About</Link>
        </nav>
        <form className="header-search" action="/search" method="get" role="search" aria-label={t('header.search')}>
          <label className="sr-only" htmlFor="header-search-input">{t('header.search')}</label>
          <input id="header-search-input" type="search" name="q" required maxLength={120} autoComplete="off" placeholder="Search BYB" />
          <input type="hidden" name="market" value={market} />
          <button type="submit" aria-label={t('header.search')}><SearchIcon /></button>
        </form>
        <div className="header-utilities">{utilities}</div>
        <div className="header-mobile-actions">
          <Link className="header-icon-action" href={`/search?market=${market}`} aria-label={t('header.search')}><SearchIcon /></Link>
          <button className="header-icon-action" aria-label={t('header.openMenu')} aria-expanded={open === 'mobile'} aria-controls="nav-mobile" onClick={event => toggle('mobile', event.currentTarget)}>☰</button>
        </div>
        <div id="nav-discover" className="nav-popover discover-popover" hidden={open !== 'discover'}>
          <nav aria-label="Discover">{discover.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}</nav>
          <p className="nav-hint">Price picks search accessories in USD.</p>
        </div>
        <div id="nav-categories" className="nav-popover mega-popover" hidden={open !== 'categories'}>
          <p>Explore by category</p><p className="nav-hint">Curated searches to help you get started.</p>
          <div className="mega-grid">{homepageCategories.map(category => <div key={category.id} className="mega-category">
            <Link className="mega-title" href={categorySearchHref(category.id, market)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={category.path} /></svg>{t(`homepage.h1.category.${category.id}`)}</Link>
            <div>{categoryQuickLinks[category.id].map(([label, query]) => <Link key={query} href={querySearchHref(query, market)}>{label}</Link>)}</div>
          </div>)}</div>
        </div>
        <div id="nav-mobile" className="header-mobile-panel" hidden={open !== 'mobile'}>
          <nav aria-label={t('header.navigation')}>
            <details><summary>Discover</summary>{discover.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}</details>
            <details><summary>Categories</summary>{homepageCategories.map(category => <details key={category.id}><summary>{t(`homepage.h1.category.${category.id}`)}</summary><Link href={categorySearchHref(category.id, market)}>Explore category</Link>{categoryQuickLinks[category.id].map(([label, query]) => <Link key={query} href={querySearchHref(query, market)}>{label}</Link>)}</details>)}</details>
            <Link href={`/how-it-works?market=${market}`}>How it works</Link><Link href={`/about?market=${market}`}>About</Link><Link href={`/partners?market=${market}`}>Partners</Link>
          </nav>
          <p>Preferences</p><div className="header-mobile-utilities">{utilities}</div>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}
