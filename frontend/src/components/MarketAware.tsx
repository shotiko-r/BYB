'use client';

import { useI18n } from '@/i18n/I18nContext';

interface MarketAwareProps {
  children: (market: any) => React.ReactNode;
}

export function MarketAware({ children }: MarketAwareProps) {
  const { locale } = useI18n();

  // Default market mapping based on locale
  const marketMap: Record<string, { code: string; name: string; currencyCode: string; currencySymbol: string }> = {
    'ka': { code: 'GE', name: 'Georgia', currencyCode: 'GEL', currencySymbol: '₾' },
    'en': { code: 'GE', name: 'Georgia', currencyCode: 'GEL', currencySymbol: '₾' }, // Default to Georgia
  };

  const market = marketMap[locale] || marketMap['en'];

  return children({
    ...market,
    locale,
    currencyCode: market.currencyCode,
    currencySymbol: market.currencySymbol,
  });
}