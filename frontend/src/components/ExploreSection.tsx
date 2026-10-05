'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';

interface ExploreCardProps {
  id: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  href?: string;
  comingSoon?: boolean;
}

export function ExploreCard({ id, title, description, icon, href, comingSoon = false }: ExploreCardProps) {
  const { t } = useI18n();

  const cardClasses = "group relative block bg-white rounded-2xl border border-gray-200 p-6 transition-all hover:shadow-xl hover:border-blue-200 hover:-translate-y-1";

  if (comingSoon || !href) {
    return (
      <article className={`${cardClasses} opacity-60 cursor-not-allowed`}>
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 110 4m0-6a2 2 0 110 4m0-3v2m0-6v2m0-6v2" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 text-sm">{description}</p>
        <span className="absolute top-4 right-4 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
          {t('homepage.explore.comingSoon')}
        </span>
      </article>
    );
  }

  return (
    <article className={cardClasses}>
      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
        <svg className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{title}</h3>
      <p className="text-gray-500 text-sm mb-4">{description}</p>
      <Link href={href} className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
        {t('common.viewAll')}
        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m0 0l-4-4m4-4H3" />
        </svg>
      </Link>
    </article>
  );
}

interface ExploreSectionProps {
  markets?: any[];
}

export function ExploreSection({ markets }: ExploreSectionProps) {
  const { t } = useI18n();

  const categories = [
    { id: 'tech', title: t('homepage.explore.tech.title'), description: t('homepage.explore.tech.description'), href: '/categories/tech' },
    { id: 'auto', title: t('homepage.explore.auto.title'), description: t('homepage.explore.auto.description'), href: '/categories/auto' },
    { id: 'home', title: t('homepage.explore.home.title'), description: t('homepage.explore.home.description'), href: '/categories/home' },
    { id: 'outdoors', title: t('homepage.explore.outdoors.title'), description: t('homepage.explore.outdoors.description'), href: '/categories/outdoors' },
    { id: 'fashion', title: t('homepage.explore.fashion.title'), description: t('homepage.explore.fashion.description'), comingSoon: true },
    { id: 'beauty', title: t('homepage.explore.beauty.title'), description: t('homepage.explore.beauty.description'), comingSoon: true },
    { id: 'sports', title: t('homepage.explore.sports.title'), description: t('homepage.explore.sports.description'), comingSoon: true },
    { id: 'kids', title: t('homepage.explore.kids.title'), description: t('homepage.explore.kids.description'), comingSoon: true },
    { id: 'pets', title: t('homepage.explore.pets.title'), description: t('homepage.explore.pets.description'), comingSoon: true },
    { id: 'tools', title: t('homepage.explore.tools.title'), description: t('homepage.explore.tools.description'), comingSoon: true },
  ];

  return (
    <section className="section" aria-labelledby="explore-heading">
      <div className="container">
        <header className="mb-10">
          <h2 id="explore-heading" className="text-3xl font-bold text-gray-900">{t('homepage.sections.explore')}</h2>
          <p className="text-gray-600 mt-2 max-w-2xl">{t('homepage.explore.subtitle')}</p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categories.map((category) => (
            <ExploreCard key={category.id} {...category} />
          ))}
        </div>
      </div>
    </section>
  );
}