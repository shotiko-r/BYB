'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';

const items = ['item', 'shipping', 'delivery', 'source', 'checked'] as const;

export function TrustSection({ market = 'GE' }: { market?: string }) {
  const { t } = useI18n();
  return <section className="trust-ledger" aria-labelledby="trust-title">
    <div className="byb-container trust-ledger-grid">
      <div className="trust-ledger-copy">
        <p className="eyebrow">{t('homepage.trust.eyebrow')}</p>
        <h2 id="trust-title">{t('homepage.trust.title')}</h2>
        <p>{t('homepage.trust.description')}</p>
        <div className="trust-links">
          <Link href={`/how-it-works?market=${market}`}>{t('homepage.trust.how')}</Link>
          <Link href={`/affiliate-disclosure?market=${market}`}>{t('homepage.trust.affiliate')}</Link>
        </div>
      </div>
      <div className="trust-ledger-list">
        <h3>{t('homepage.trust.listTitle')}</h3>
        <ul>{items.map(item => <li key={item}>
          <span className="trust-item-mark" aria-hidden="true" />
          {t(`homepage.trust.items.${item}`)}
        </li>)}</ul>
        <p className="trust-note">{t('homepage.trust.note')}</p>
      </div>
    </div>
  </section>;
}
