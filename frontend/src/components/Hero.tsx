'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';
import type { Market } from '@/types';

export function Hero({ market }: { market: Market }) {
  const { t } = useI18n();
  return <section className="home-intro byb-container" aria-labelledby="home-title">
    <div>
      <p className="eyebrow">{t('homepage.h1.eyebrow')}</p>
      <h1 id="home-title">{t('homepage.h1.title')}</h1>
      <p className="home-intro-description">{t('homepage.h1.description')}</p>
    </div>
    <Link className="home-search-link" href={`/search?market=${market.code}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg>
      {t('homepage.h1.search')} <span aria-hidden="true">→</span>
    </Link>
  </section>;
}
