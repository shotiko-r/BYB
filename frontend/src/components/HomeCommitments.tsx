'use client';

import { useI18n } from '@/i18n/I18nContext';

const commitments = [
  { id: 'sell', index: '01' },
  { id: 'ranking', index: '02' },
  { id: 'merchant', index: '03' },
] as const;

export function HomeCommitments() {
  const { t } = useI18n();
  return <section className="home-commitments" aria-labelledby="commitments-title">
    <div className="byb-container">
      <div className="home-commitments-heading">
        <p className="eyebrow">{t('homepage.commitments.eyebrow')}</p>
        <h2 id="commitments-title">{t('homepage.commitments.title')}</h2>
      </div>
      <div className="home-commitments-grid">
        {commitments.map(commitment => <article className="home-commitment" key={commitment.id}>
          <span className="commitment-index" aria-hidden="true">{commitment.index}</span>
          <h3>{t(`homepage.commitments.${commitment.id}.title`)}</h3>
          <p>{t(`homepage.commitments.${commitment.id}.description`)}</p>
        </article>)}
      </div>
      <div className="home-steps" role="group" aria-label={t('homepage.steps.title')}>
        {(['search', 'compare', 'buy'] as const).map((step, index) => <div key={step}>
          <span aria-hidden="true">0{index + 1}</span>
          <h3>{t(`homepage.steps.${step}.title`)}</h3>
          <p>{t(`homepage.steps.${step}.description`)}</p>
        </div>)}
      </div>
    </div>
  </section>;
}
