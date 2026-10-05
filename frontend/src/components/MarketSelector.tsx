'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import type { Market } from '@/types';

interface MarketSelectorProps {
  markets: Market[];
  selectedMarket: Market;
  onSelect: (market: Market) => void;
}

export function MarketSelector({ markets, selectedMarket, onSelect }: MarketSelectorProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t('header.selectMarket')}
      >
        <span className="font-medium">{selectedMarket.code}</span>
        <span className="text-sm text-gray-500">{selectedMarket.currencySymbol}</span>
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <ul role="listbox" aria-label={t('header.selectMarket')}>
            {markets.map((market) => (
              <li key={market.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={market.id === selectedMarket.id}
                  onClick={() => {
                    onSelect(market);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left transition-colors ${
                    market.id === selectedMarket.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50'
                    }`}
                >
                  <div className="font-medium">{market.name}</div>
                  <div className="text-sm text-gray-500">{market.code} • {market.currencySymbol}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}