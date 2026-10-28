'use client';

import { useState, useSyncExternalStore } from 'react';
import type { Market } from '@/types';
import { navigationMarkets } from './navigation-markets';

const subscribe = (notify: () => void) => {
  window.addEventListener('popstate', notify);
  return () => window.removeEventListener('popstate', notify);
};
const snapshot = () => new URLSearchParams(window.location.search).get('market') || 'GE';
const serverSnapshot = () => 'GE';

export function useNavigationMarket() {
  const code = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [choice, setChoice] = useState<Market | null>(null);
  const selected = choice || navigationMarkets.find(item => item.code === code) || navigationMarkets[0];
  return [selected, setChoice] as const;
}
