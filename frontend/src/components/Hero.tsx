'use client';

import { useI18n } from '@/i18n/I18nContext';
import { ConciergeSearch } from './ConciergeSearch';
import type { Market } from '@/types';

export function Hero({ market }: {
  market: Market;
  onSearch: (query: string) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="byb-hero">
      <div className="hero-panels" aria-hidden="true"><i /><i /></div>
      <div className="byb-container hero-content">
        <p className="eyebrow">{t('homepage.hero.title')}</p>
        <h1>{t('homepage.hero.subtitle')}</h1>
        <p className="hero-description">{t('homepage.hero.description')}</p>
        <ConciergeSearch key={market.code} market={market} />
      </div>
    </section>
  );
}
