'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ConciergeAnswersSchema, ConciergeResponseSchema, type ConciergeRequest, type ConciergeResponse, type ConciergeQuestion } from '@byb/shared';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import type { Market, ProductWithOffers } from '@/types';
import { SearchInput } from './SearchInput';

type Answers = NonNullable<ConciergeRequest['answers']>;
type Draft = { fields: Partial<Record<ConciergeQuestion['id'], string>>; features: string[]; budget: string; currency: string; unlimited: boolean };
const initialDraft = (currency: string): Draft => ({ fields: {}, features: [], budget: '', currency, unlimited: false });

function priceFor(product: ProductWithOffers, currency?: string) {
  const offers = product.offers.filter(o => o.isActive && o.availability !== 'out_of_stock');
  // Compare prices within a single currency; never rank raw amounts across currencies.
  const selectedCurrency = offers.some(o => o.currencyCode === currency) ? currency : offers[0]?.currencyCode;
  return offers.filter(o => o.currencyCode === selectedCurrency).sort((a, b) => a.priceAmount - b.priceAmount)[0];
}
function displayPrice(amount: number, currency: string) {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / 10 ** (digits ?? 2));
}

export function ConciergeSearch({ market }: { market: Market }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [originalQuery, setOriginalQuery] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [draft, setDraft] = useState<Draft>(() => initialDraft(market.currencyCode));
  const [response, setResponse] = useState<ConciergeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [validationError, setValidationError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);

  function reset(clearQuery: boolean) {
    controller.current?.abort(); controller.current = null;
    setResponse(null); setError(false); setValidationError(false); setAnswers({}); setLoading(false); setOriginalQuery('');
    setDraft(initialDraft(market.currencyCode));
    if (clearQuery) setQuery('');
    root.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
  }
  async function request(requestQuery: string, collected: Answers) {
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    setLoading(true); setError(false); setValidationError(false);
    try {
      const result = await api.concierge.request({ query: requestQuery, market: market.code, answers: Object.keys(collected).length ? collected : undefined }, current.signal);
      const parsed = ConciergeResponseSchema.safeParse(result);
      if (!parsed.success) throw new Error('Invalid Concierge response');
      if (controller.current !== current) return;
      // Keep optional merchant metadata from the original payload when present.
      setResponse(result);
      if (result.status === 'needs_clarification') {
        const knownCurrency = result.questions.find(q => q.id === 'budget')?.prompt.match(/\bin ([A-Z]{3})\b/)?.[1];
        if (knownCurrency) setDraft(d => ({ ...d, currency: knownCurrency }));
      }
    } catch (cause) {
      if (current.signal.aborted || controller.current !== current) return;
      console.error('Concierge request failed', cause);
      setError(true);
    } finally {
      if (controller.current === current) setLoading(false);
    }
  }
  function start(value: string) {
    const clean = value.trim(); if (!clean) return;
    setQuery(clean); setOriginalQuery(clean); setAnswers({}); setResponse(null);
    setDraft(initialDraft(market.currencyCode));
    void request(clean, {});
  }
  function submitAnswers(event: React.FormEvent) {
    event.preventDefault();
    if (loading || response?.status !== 'needs_clarification') return;
    const collected: Answers = { ...answers };
    try {
      for (const question of response.questions) {
        if (question.id === 'budget') {
          if (draft.unlimited) collected.budget = { unlimited: true };
          else {
            const currencyCode = draft.currency.trim().toUpperCase();
            const digits = new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode }).resolvedOptions().maximumFractionDigits ?? 2;
            const amount = Number(draft.budget);
            const scaled = amount * 10 ** digits;
            const maxPrice = Math.round(scaled);
            if (!draft.budget.trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(maxPrice) || Math.abs(scaled - maxPrice) > 0.00001) throw new Error('Invalid amount');
            collected.budget = { maxPrice, currencyCode };
          }
        } else if (question.id === 'features') {
          collected.features = question.options?.length ? draft.features : (draft.fields.features || '').split(',').map(s => s.trim()).filter(Boolean);
        } else {
          const value = draft.fields[question.id]?.trim() || '';
          if (!value) throw new Error('Missing answer');
          collected[question.id] = question.id === 'currencyCode' ? value.toUpperCase() : value;
        }
      }
      const validated = ConciergeAnswersSchema.safeParse(collected);
      if (!validated.success) throw new Error('Invalid answers');
      setAnswers(validated.data);
      void request(originalQuery, validated.data);
    } catch { setValidationError(true); }
  }
  const visible = Boolean(originalQuery);
  return (
    <div ref={root} className="concierge-search">
      <SearchInput market={market} onSearch={start} placeholder={t('homepage.hero.placeholder')} homepage queryValue={query} onQueryChange={value => { reset(false); setQuery(value); }} busy={loading} />
      {visible && (
        <section className="concierge-panel" aria-labelledby="concierge-title" aria-busy={loading}>
          <div className="concierge-heading">
            <h2 id="concierge-title">{t('concierge.title')}</h2>
            <div className="concierge-actions">
              <button type="button" onClick={() => reset(false)}>{t('concierge.edit')}</button>
              <button type="button" onClick={() => reset(true)}>{t('concierge.restart')}</button>
            </div>
          </div>
          <p className="concierge-muted concierge-original">{t('concierge.request', { query: originalQuery })}</p>
          {loading && <p role="status" className="concierge-muted">{t('concierge.loading')}</p>}
          {error && <div role="alert" className="concierge-error"><p>{t('concierge.error')}</p><button type="button" className="concierge-secondary" disabled={loading} onClick={() => void request(originalQuery, answers)}>{t('concierge.retry')}</button></div>}
          {response?.status === 'needs_clarification' && (
            <form onSubmit={submitAnswers}>
              <p className="concierge-muted">{t('concierge.clarify')}</p>
              <fieldset disabled={loading} className="concierge-fields">
                {response.questions.map(question => (
                  <fieldset key={question.id} className="concierge-question">
                    <legend>{question.prompt}</legend>
                    {question.id === 'budget' ? (
                      <>
                        <label className="concierge-check"><input type="checkbox" checked={draft.unlimited} onChange={e => setDraft(d => ({ ...d, unlimited: e.target.checked }))} />{t('concierge.unlimited')}</label>
                        <div className="concierge-budget">
                          <label>{t('concierge.budget')}<input type="number" required={!draft.unlimited} disabled={draft.unlimited} min="0" step="any" value={draft.budget} onChange={e => setDraft(d => ({ ...d, budget: e.target.value }))} /></label>
                          <label>{t('concierge.currency')}<input required={!draft.unlimited} disabled={draft.unlimited} maxLength={3} pattern="[A-Za-z]{3}" value={draft.currency} onChange={e => setDraft(d => ({ ...d, currency: e.target.value.toUpperCase() }))} /></label>
                        </div>
                        <p className="concierge-muted">{t('concierge.budgetHelp')}</p>
                      </>
                    ) : question.id === 'features' && question.options?.length ? (
                      <div className="concierge-options">
                        {question.options.map(option => <label className="concierge-check" key={option.value}><input type="checkbox" checked={draft.features.includes(option.value)} onChange={e => setDraft(d => ({ ...d, features: e.target.checked ? [...d.features, option.value] : d.features.filter(f => f !== option.value) }))} />{option.label}</label>)}
                        <label className="concierge-check"><input type="checkbox" checked={!draft.features.length} onChange={() => setDraft(d => ({ ...d, features: [] }))} />{t('concierge.none')}</label>
                      </div>
                    ) : (
                      <>
                        <label className="sr-only" htmlFor={`concierge-${question.id}`}>{question.prompt}</label>
                        <input id={`concierge-${question.id}`} list={`concierge-options-${question.id}`} required={question.id !== 'features'} value={draft.fields[question.id] || ''} maxLength={question.id === 'currencyCode' ? 3 : 100} placeholder={t('concierge.custom')} onChange={e => setDraft(d => ({ ...d, fields: { ...d.fields, [question.id]: e.target.value } }))} />
                        {question.options && <datalist id={`concierge-options-${question.id}`}>{question.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist>}
                      </>
                    )}
                  </fieldset>
                ))}
              </fieldset>
              {validationError && <p role="alert" className="concierge-error">{t('concierge.invalid')}</p>}
              <button className="request-submit concierge-continue" type="submit" disabled={loading}>{t('concierge.continue')}</button>
            </form>
          )}
          {!loading && response?.status === 'recommendations' && (
            response.recommendations.length ? <div className="concierge-results">
              {response.recommendations.slice(0, 4).map((recommendation, index) => {
                const product: ProductWithOffers = recommendation.product;
                const offer = priceFor(product, response.intent.currencyCode);
                const merchant = offer?.merchant ?? product.merchant;
                return <article className={`decision-card concierge-card ${index === 0 ? 'concierge-pick' : ''}`} key={product.id}>
                  <div className="concierge-card-heading">{index === 0 && <span className="concierge-pick-label">{t('concierge.pick')}</span>}<span className="concierge-muted">{t('concierge.match', { score: recommendation.matchScore })}</span></div>
                  {product.imageUrl && <div className="decision-image"><Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 600px) 100vw, 400px" unoptimized /></div>}
                  <div className="decision-info">
                    <h3 className="decision-name">{product.name}</h3>
                    {offer ? <><p className="decision-price">{displayPrice(offer.priceAmount, offer.currencyCode)}</p><p className="concierge-muted">{t('concierge.priceLabel', { currency: offer.currencyCode })}</p>{merchant?.name && <p className="decision-merchant">{merchant.name}</p>}<p className="decision-merchant">{t(`product.availability.${offer.availability}`)}</p></> : <p className="concierge-muted">{t('concierge.priceUnavailable')}</p>}
                    {!!recommendation.reasons.length && <ul className="concierge-reasons">{recommendation.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>}
                    <Link className="decision-offers" href={`/product/${encodeURIComponent(product.id)}?market=${encodeURIComponent(market.code)}`}>{t('concierge.view')}<span aria-hidden="true">↗</span></Link>
                  </div>
                </article>;
              })}
            </div> : <p role="status" className="concierge-muted">{t('concierge.empty')}</p>
          )}
        </section>
      )}
    </div>
  );
}
