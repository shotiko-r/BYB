'use client';

import Link from 'next/link';
import { Logo } from './Logo';
import { useI18n } from '@/i18n/I18nContext';
import { navigationMarkets } from '@/lib/navigation-markets';

export function Footer({ market = 'GE' }: { market?: string }) {
  const { t } = useI18n();
  const destination = (route: string) => `${route}?market=${encodeURIComponent(market)}`;
  return <footer className="byb-footer mt-auto"><div className="byb-container py-12">
    <div className="footer-navigation">
      <div><Link className="footer-home" href={destination('/')} aria-label={t('footer.home')}><Logo /></Link><p className="mt-4 text-sm max-w-sm">{t('footer.tagline')}</p><p className="mt-3 text-sm max-w-sm">{t('footer.compareNote')}</p></div>
      <nav aria-label={t('footer.sections.explore')}><h3>{t('footer.sections.explore')}</h3><Link href={destination('/search')}>{t('footer.links.search')}</Link><Link href={`${destination('/')}#explore`}>{t('footer.links.categories')}</Link><Link href={destination('/how-it-works')}>{t('footer.links.howItWorks')}</Link></nav>
      <nav aria-label={t('footer.sections.about')}><h3>{t('footer.sections.about')}</h3><Link href={destination('/about')}>{t('footer.links.about')}</Link><Link href={destination('/partners')}>{t('footer.links.partners')}</Link><Link href={destination('/contact')}>{t('footer.links.contact')}</Link></nav>
      <nav aria-label={t('footer.sections.transparency')}><h3>{t('footer.sections.transparency')}</h3><Link href={destination('/affiliate-disclosure')}>{t('footer.links.affiliate')}</Link></nav>
      <nav aria-label={t('footer.markets')}><h3>{t('footer.markets')}</h3>{navigationMarkets.map(item =>
        <Link key={item.code} href={`/?market=${item.code}`}>{item.name} · {item.currencyCode}</Link>)}</nav>
    </div>
    <div className="footer-legal mt-10 pt-6"><p>{t('footer.copyright', { year: new Date().getFullYear() })}</p></div>
  </div></footer>;
}
