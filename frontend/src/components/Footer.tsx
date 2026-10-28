'use client';

import Link from 'next/link';
import { Logo } from './Logo';
import { useI18n } from '@/i18n/I18nContext';

export function Footer({ market = 'GE' }: { market?: string }) {
  const { t } = useI18n();
  const destination = (route: string) => `${route}?market=${encodeURIComponent(market)}`;
  return <footer className="byb-footer mt-auto"><div className="byb-container py-12">
    <div className="footer-navigation">
      <div><Link href={destination('/')} aria-label="BYB Home"><Logo /></Link><p className="mt-4 text-sm max-w-sm">{t('footer.tagline')}</p><p className="mt-3 text-sm max-w-sm">Compare here. Buy on the merchant’s website.</p></div>
      <nav aria-label="Explore BYB"><h3>Explore BYB</h3><Link href={destination('/search')}>{t('footer.links.search')}</Link><Link href={`${destination('/')}#explore`}>{t('footer.links.categories')}</Link><Link href={destination('/how-it-works')}>How it works</Link></nav>
      <nav aria-label="About BYB"><h3>About BYB</h3><Link href={destination('/about')}>About</Link><Link href={destination('/partners')}>Partner with BYB</Link><Link href={destination('/contact')}>Contact</Link></nav>
      <nav aria-label="Transparency"><h3>Transparency</h3><Link href={destination('/affiliate-disclosure')}>Affiliate disclosure</Link></nav>
    </div>
    <div className="mt-10 pt-6 border-t border-gray-200"><p className="text-sm text-center">{t('footer.copyright', { year: new Date().getFullYear() })}</p></div>
  </div></footer>;
}
