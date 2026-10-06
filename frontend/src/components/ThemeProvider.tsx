'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useI18n } from '@/i18n/I18nContext';

type Theme = 'system' | 'light' | 'dark';
const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: 'system', setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('byb-theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') setTheme(saved);
    } catch {
      // System mode remains available when browser storage is restricted.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    // Preserve the pre-paint script's selection until storage has been read.
    if (!ready) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system'
        ? (media.matches ? 'dark' : 'light')
        : theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, ready]);

  const choose = (value: Theme) => {
    setTheme(value);
    try { localStorage.setItem('byb-theme', value); } catch {
      // The current session still honors the manual choice.
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: choose }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeSelector() {
  const { theme, setTheme } = useContext(ThemeContext);
  const { t } = useI18n();

  return (
    <label className="utility-select">
      <span className="sr-only">{t('header.theme.label')}</span>
      <select value={theme} onChange={event => setTheme(event.target.value as Theme)}>
        {(['system', 'light', 'dark'] as const).map(value => (
          <option key={value} value={value}>{t(`header.theme.${value}`)}</option>
        ))}
      </select>
    </label>
  );
}
