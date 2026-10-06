'use client';

import { useI18n } from '@/i18n/I18nContext';
import type { Market } from '@/types';

export function MarketSection({ market }: { market: Market }) {
  const { t } = useI18n();
  return (
    <section className="market-section byb-container" aria-labelledby="market-heading">
      <div>
        <p className="eyebrow">{market.code} · {market.currencyCode}</p>
        <h2 id="market-heading">{t('homepage.market.shoppingFrom', { market: market.name })}</h2>
      </div>
      <div className="market-topics">
        {['delivery', 'localAvailability', 'currency', 'customs'].map(key => (
          <span key={key}>
            {t(`homepage.market.${key}`)}
            {key === 'currency' && <small>{market.currencyCode} · {market.currencySymbol}</small>}
          </span>
        ))}
      </div>
    </section>
  );
}
