'use client';

import { useI18n } from '@/i18n/I18nContext';
import { SearchInput } from './SearchInput';

interface HeroProps {
  market: any;
  onSearch: (query: string) => void;
}

export function Hero({ market, onSearch }: HeroProps) {
  const { t, tArray } = useI18n();
  const examples = tArray('homepage.hero.examples.items');

  return (
    <section className="relative bg-gradient-to-b from-blue-50 to-white py-16 sm:py-20 lg:py-24">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight mb-4">
            {t('homepage.hero.title')}
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
            {t('homepage.hero.subtitle')}
          </p>
          <p className="text-lg sm:text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
            {t('homepage.hero.description')}
          </p>
          <SearchInput market={market} onSearch={onSearch} placeholder={t('homepage.hero.placeholder')} />
          <p className="mt-3 text-sm text-gray-500">
            {t('homepage.hero.examples.label')}
            {' '}
            <span className="font-medium text-gray-700">{examples[0] || ''}</span>
            {' '}or{' '}
            <span className="font-medium text-gray-700">{examples[1] || ''}</span>
          </p>
        </div>
      </div>
    </section>
  );
}