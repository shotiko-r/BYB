import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-auto">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2" aria-label="BYB Home">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span className="text-xl font-bold text-gray-900">BYB</span>
            </Link>
            <p className="mt-4 text-sm text-gray-600 max-w-xs">
              {t('footer.tagline')}
            </p>
          </div>

          <nav aria-label={t('footer.product')}>
            <h3 className="font-semibold text-gray-900 mb-4">{t('footer.product')}</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/search" className="hover:text-blue-600 transition-colors">{t('footer.links.search')}</Link></li>
              <li><Link href="/trending" className="hover:text-blue-600 transition-colors">{t('footer.links.trending')}</Link></li>
              <li><Link href="/deals" className="hover:text-blue-600 transition-colors">{t('footer.links.deals')}</Link></li>
              <li><Link href="/categories" className="hover:text-blue-600 transition-colors">{t('footer.links.categories')}</Link></li>
              <li><Link href="/new" className="hover:text-blue-600 transition-colors">{t('footer.links.newReleases')}</Link></li>
            </ul>
          </nav>

          <nav aria-label={t('footer.company')}>
            <h3 className="font-semibold text-gray-900 mb-4">{t('footer.company')}</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/about" className="hover:text-blue-600 transition-colors">{t('footer.links.about')}</Link></li>
              <li><Link href="/blog" className="hover:text-blue-600 transition-colors">{t('footer.links.blog')}</Link></li>
              <li><Link href="/careers" className="hover:text-blue-600 transition-colors">{t('footer.links.careers')}</Link></li>
              <li><Link href="/press" className="hover:text-blue-600 transition-colors">{t('footer.links.press')}</Link></li>
            </ul>
          </nav>

          <nav aria-label={t('footer.legal')}>
            <h3 className="font-semibold text-gray-900 mb-4">{t('footer.legal')}</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/privacy" className="hover:text-blue-600 transition-colors">{t('footer.links.privacy')}</Link></li>
              <li><Link href="/terms" className="hover:text-blue-600 transition-colors">{t('footer.links.terms')}</Link></li>
              <li><Link href="/cookies" className="hover:text-blue-600 transition-colors">{t('footer.links.cookies')}</Link></li>
              <li><Link href="/affiliate" className="hover:text-blue-600 transition-colors">{t('footer.links.affiliate')}</Link></li>
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