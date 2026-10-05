'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';

interface LanguageSelectorProps {
  className?: string;
}

export function LanguageSelector({ className = '' }: LanguageSelectorProps) {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'en' as const, name: 'English', nativeName: 'English' },
    { code: 'ka' as const, name: 'Georgian', nativeName: 'ქართული' },
  ] as const;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t('header.selectLanguage')}
      >
        <span className="font-medium text-sm">
          {languages.find(l => l.code === locale)?.nativeName || locale.toUpperCase()}
        </span>
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <ul role="listbox" aria-label={t('header.selectLanguage')}>
              {languages.map((language) => (
                <li key={language.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={locale === language.code}
                    onClick={() => {
                      setIsOpen(false);
                      setLocale(language.code);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      locale === language.code
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {language.nativeName}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
}