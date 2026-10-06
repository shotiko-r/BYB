'use client';

import { useI18n } from '@/i18n/I18nContext';
import type { Market } from '@/types';

export function MarketSelector({ markets, selectedMarket, onSelect }: {
  markets: Market[];
  selectedMarket: Market;
  onSelect: (market: Market) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="utility-select">
      <span className="sr-only">{t('header.selectMarket')}</span>
      <select
        value={selectedMarket.id}
        onChange={event => {
          const market = markets.find(item => item.id === event.target.value);
          if (market) onSelect(market);
        }}
      >
        {markets.map(market => (
          <option key={market.id} value={market.id}>{market.code} · {market.currencySymbol}</option>
        ))}
      </select>
    </label>
  );
}
