'use client';

import { useState } from 'react';
import { clearInterests } from '@/lib/local-interests';
import { useI18n } from '@/i18n/I18nContext';

export function HomeBrowsingMemory() {
  const { t } = useI18n();
  const [cleared, setCleared] = useState(false);
  return <div className="home-memory byb-container">
    <p>{t('homepage.h1.memory')}</p>
    <button type="button" onClick={() => { clearInterests(); setCleared(true); }}>{t('homepage.h1.clearMemory')}</button>
    <span role="status">{cleared ? t('homepage.h1.memoryCleared') : ''}</span>
  </div>;
}
