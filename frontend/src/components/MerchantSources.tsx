'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';

const sources = [
  { id: 'ebay', name: 'eBay', mark: 'ebay' },
  { id: 'aliexpress', name: 'AliExpress', mark: 'AliExpress' },
  { id: 'fmtc', name: 'FMTC', mark: 'FMTC' },
] as const;

export function MerchantSources({ market = 'GE' }: { market?: string }) {
  const { t } = useI18n();
  return <section className="merchant-sources" aria-labelledby="sources-title">
    <div className="byb-container">
      <div className="sources-heading">
        <p className="eyebrow">{t('homepage.sources.eyebrow')}</p>
        <h2 id="sources-title">{t('homepage.sources.title')}</h2>
        <p>{t('homepage.sources.description')}</p>
      </div>
      <ul className="source-list">
        {sources.map(source => <li className="source-card" key={source.id}>
          <span className={`source-mark source-mark-${source.id}`}>{source.mark}</span>
          <p>{t(`homepage.sources.${source.id}`)}</p>
        </li>)}
      </ul>
      <p className="sources-note">{t('homepage.sources.note')} <Link href={`/how-it-works?market=${market}`}>{t('homepage.sources.method')}</Link></p>
    </div>
  </section>;
}
