'use client';

import { useI18n } from '@/i18n/I18nContext';

export function LanguageSelector({ className = '' }: { className?: string }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <label className={`utility-select ${className}`}>
      <span className="sr-only">{t('header.selectLanguage')}</span>
      <select value={locale} onChange={event => setLocale(event.target.value as 'en' | 'ka')}>
        <option value="en">EN</option>
        <option value="ka">ქართული</option>
      </select>
    </label>
  );
}
