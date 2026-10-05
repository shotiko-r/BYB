'use client';

import { I18nProvider } from '@/i18n/I18nContext';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <I18nProvider defaultLocale="en">{children}</I18nProvider>;
}