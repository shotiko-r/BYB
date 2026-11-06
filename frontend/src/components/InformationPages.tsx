'use client';

import { InformationLink, InformationPage } from './InformationPage';
import { useI18n } from '@/i18n/I18nContext';

const howSteps = [
  'search',
  'compare',
  'details',
  'merchant',
  'checkout',
] as const;

export function HowItWorksInformation() {
  const { t } = useI18n();
  return <InformationPage title={t('information.how.title')} intro={t('information.how.intro')}>
    <ol className="information-steps">
      {howSteps.map((step, index) => <li key={step}>
        <span className="information-step-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <div>
          <h2>{t(`information.how.steps.${step}.title`)}</h2>
          <p>{t(`information.how.steps.${step}.body`)}</p>
        </div>
      </li>)}
    </ol>
    <section className="information-callout">
      <h2>{t('information.how.before.title')}</h2>
      <p>{t('information.how.before.body')}</p>
      <p>{t('information.how.before.disclosure')} <InformationLink href="/affiliate-disclosure">{t('information.how.before.link')}</InformationLink>.</p>
    </section>
  </InformationPage>;
}

export function AboutInformation() {
  const { t } = useI18n();
  return <InformationPage title={t('information.about.title')} intro={t('information.about.intro')}>
    <section>
      <h2>{t('information.about.what.title')}</h2>
      <p>{t('information.about.what.body')}</p>
    </section>
    <section>
      <h2>{t('information.about.model.title')}</h2>
      <p>{t('information.about.model.body')}</p>
    </section>
    <section>
      <h2>{t('information.about.region.title')}</h2>
      <p>{t('information.about.region.body')}</p>
    </section>
  </InformationPage>;
}

export function PartnersInformation() {
  const { t } = useI18n();
  return <InformationPage title={t('information.partners.title')} intro={t('information.partners.intro')}>
    <section>
      <h2>{t('information.partners.audience.title')}</h2>
      <p>{t('information.partners.audience.body')}</p>
    </section>
    <section>
      <h2>{t('information.partners.catalog.title')}</h2>
      <p>{t('information.partners.catalog.body')}</p>
    </section>
    <section>
      <h2>{t('information.partners.region.title')}</h2>
      <p>{t('information.partners.region.body')}</p>
    </section>
    <section>
      <h2>{t('information.partners.contact.title')}</h2>
      <p>{t('information.partners.contact.body')}</p>
      <div className="information-action">
        <InformationLink href="/contact" className="btn-secondary">{t('information.partners.contact.action')}</InformationLink>
      </div>
    </section>
  </InformationPage>;
}

export function ContactInformation() {
  const { t } = useI18n();
  return <InformationPage title={t('information.contact.title')} intro={t('information.contact.intro')}>
    <section>
      <h2>{t('information.contact.form.title')}</h2>
      <p>{t('information.contact.form.body')}</p>
    </section>
    <section>
      <h2>{t('information.contact.purchase.title')}</h2>
      <p>{t('information.contact.purchase.body')}</p>
    </section>
  </InformationPage>;
}

export function AffiliateDisclosureInformation() {
  const { t } = useI18n();
  return <InformationPage title={t('information.affiliate.title')} intro={t('information.affiliate.intro')}>
    <section>
      <h2>{t('information.affiliate.commission.title')}</h2>
      <p>{t('information.affiliate.commission.body')}</p>
    </section>
    <section>
      <h2>{t('information.affiliate.merchant.title')}</h2>
      <p>{t('information.affiliate.merchant.body')}</p>
    </section>
    <section>
      <h2>{t('information.affiliate.comparison.title')}</h2>
      <p>{t('information.affiliate.comparison.body')}</p>
    </section>
  </InformationPage>;
}
