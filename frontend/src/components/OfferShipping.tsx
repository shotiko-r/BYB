'use client';

import { useI18n } from '@/i18n/I18nContext';
import { shippingFacts, deliveryDates } from '@/lib/shipping-presentation';
import { formatMoney } from '@/lib/offer-prices';
import type { Offer } from '@/types';

export function OfferShipping({ offer }: { offer: Offer }) {
  const { t, locale } = useI18n();
  const facts = shippingFacts(offer);
  if (!facts) return null;
  const dates = deliveryDates(facts, locale);
  let destination = facts.destination;
  if (destination) { try { destination = new Intl.DisplayNames([locale], { type: 'region' }).of(destination); } catch { /* Use explicit country code. */ } }
  return <div className="offer-shipping">
    <dl className="purchase-facts">
      {facts.cost && <div><dt>{t('product.p1.shipping')}</dt><dd>{facts.cost.amount === 0 ? t('product.shipping.free') : formatMoney(facts.cost.amount, facts.cost.currencyCode)}</dd></div>}
      {facts.service && <div><dt>{t('product.p1.service')}</dt><dd>{facts.service}</dd></div>}
      {dates && <div><dt>{t('product.p1.delivery')}</dt><dd>{facts.minimum && facts.maximum ? dates : t(facts.maximum ? 'product.p1.by' : 'product.p1.from', { date: dates })}</dd></div>}
    </dl>
    <p className="delivery-context">{destination ? t('product.p1.destination', { destination }) : t('product.p1.unconfirmed')}</p>
  </div>;
}
