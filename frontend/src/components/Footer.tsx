import Link from 'next/link';
import { Logo } from './Logo';
import { useI18n } from '@/i18n/I18nContext';

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="byb-footer mt-auto">
      <div className="byb-container py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="flex items-center gap-2" aria-label="BYB Home">
              <Logo />
            </Link>
            <p className="mt-4 text-sm text-gray-600 max-w-sm">
              {t('footer.tagline')}
            </p>
          </div>

          <nav aria-label={t('footer.product')}>
            <h3 className="font-semibold text-gray-900 mb-4">{t('footer.product')}</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/search" className="hover:text-blue-600 transition-colors">{t('footer.links.search')}</Link></li>
              <li><Link href="/#explore" className="hover:text-blue-600 transition-colors">{t('footer.links.categories')}</Link></li>
              <li><Link href="/search?q=headphones&sort=newest" className="hover:text-blue-600 transition-colors">{t('homepage.sections.newOnByb')}</Link></li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}