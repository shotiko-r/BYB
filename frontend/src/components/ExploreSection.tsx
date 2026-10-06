'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';

const destinations = [
  { id: 'tech', path: 'M5 4h14v11H5z M9 20h6 M12 15v5' },
  { id: 'auto', path: 'M4 15V9l3-5h10l3 5v6 M4 10h16 M6 15v4 M18 15v4 M7 13h1 M16 13h1' },
  { id: 'home', path: 'M3 11l9-8 9 8 M6 9v12h12V9 M10 21v-7h4v7' },
  { id: 'outdoors', path: 'M3 20L12 4l9 16H3Z M12 4v16 M9 20l3-6 3 6' },
];
const futureDestinations = ['fashion', 'beauty', 'sports', 'kids', 'pets', 'tools'];

export function ExploreSection() {
  const { t } = useI18n();
  return (
    <section className="explore-section byb-container" aria-labelledby="explore-heading">
      <div className="section-heading">
        <div>
          <h2 id="explore-heading">{t('homepage.sections.explore')}</h2>
          <p>{t('homepage.explore.subtitle')}</p>
        </div>
      </div>
      <div className="destination-grid">
        {destinations.map(({ id, path }, index) => (
          <Link className={`destination destination-${id}`} key={id} href={`/categories/${id}`}>
            <div className="destination-top">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={path} />
              </svg>
              <span aria-hidden="true">0{index + 1}</span>
            </div>
            <h3>{t(`homepage.explore.${id}.title`)}<span aria-hidden="true">↗</span></h3>
            <p>{t(`homepage.explore.${id}.description`)}</p>
          </Link>
        ))}
      </div>
      <div className="future-destinations">
        <span>{t('homepage.explore.comingSoon')}</span>
        {futureDestinations.map(id => (
          <span key={id} title={t(`homepage.explore.${id}.description`)}>
            {t(`homepage.explore.${id}.title`)}
          </span>
        ))}
      </div>
    </section>
  );
}
