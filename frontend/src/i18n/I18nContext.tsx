'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Locale = 'en' | 'ka';

type Translations = Record<string, any>;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tArray: (key: string) => string[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Static imports for translations
import enTranslations from './locales/en.json';
import kaTranslations from './locales/ka.json';

const staticTranslations: Record<Locale, Translations> = {
  en: enTranslations,
  ka: kaTranslations,
};

interface I18nProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

export function I18nProvider({ children, defaultLocale = 'en' }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('byb-locale') as Locale | null;
      if (saved && (saved === 'en' || saved === 'ka')) {
        return saved;
      }
      // Detect browser language
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'ka') return 'ka';
    }
    return defaultLocale;
  });

  // Translations are statically imported, so we can use them immediately
  const [translationsLoaded] = useState<Record<Locale, Translations>>({
    en: staticTranslations.en,
    ka: staticTranslations.ka,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Persist locale selection
  useEffect(() => {
    localStorage.setItem('byb-locale', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const translation = translationsLoaded[locale];
    if (!translation) return key;

    const keys = key.split('.');
    let value: any = translation;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }

    if (typeof value !== 'string') return key;

    // Replace parameters
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return params[key] !== undefined ? String(params[key]) : match;
      });
    }

    return value;
  }, [locale, translationsLoaded]);

  const tArray = useCallback((key: string): string[] => {
    const translation = translationsLoaded[locale];
    if (!translation) return [];

    const keys = key.split('.');
    let value: any = translation;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return [];
      }
    }

    if (Array.isArray(value)) {
      return value;
    }

    return [];
  }, [locale, translationsLoaded]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, tArray }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export function useLocale(): Locale {
  const { locale } = useI18n();
  return locale;
}

export function useSetLocale(): (locale: Locale) => void {
  const { setLocale } = useI18n();
  return setLocale;
}

export function useTranslation() {
  const { t } = useI18n();
  return { t };
}