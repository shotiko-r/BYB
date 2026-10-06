import { defineConfig } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  { rules: { 'react/no-unescaped-entities': 'off' } },
  {
    files: ['src/components/ThemeProvider.tsx'],
    // Hydrate persisted preferences after SSR; reading storage during the first
    // render would change the existing server/client hydration behavior.
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
]);
