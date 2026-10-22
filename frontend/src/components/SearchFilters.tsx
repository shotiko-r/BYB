'use client';

import { useState } from 'react';
import { SEARCH_CURRENCIES, type SearchOptions } from '@byb/shared';
import { useI18n } from '@/i18n/I18nContext';
import { clearedFilters, priceInput, pricePatch, type SearchState } from '@/lib/search-presentation';
import { formatMoney } from '@/lib/offer-prices';

export function SearchFilters({ state, options, onChange, pending = false }: {
  state: SearchState; options?: SearchOptions; onChange: (patch: Partial<SearchState>) => void; pending?: boolean;
}) {
  const { t } = useI18n();
  const [priceError, setPriceError] = useState(false);
  const merchants = options?.merchants ?? [];
  const categories = options?.categories ?? [];
  const priceText = (value: string) => { try { return formatMoney(Number(value), state.currency); } catch { return value; } };
  return <section className="search-filters" aria-label={t('search.filters')}>
    <div className="filter-toolbar">
      <label className="filter-control">{t('search.sortBy')}
        <select id="sort" className="filter-select" value={state.sort} disabled={pending} onChange={event => onChange({ sort: event.target.value as SearchState['sort'] })}>
          <option value="relevance">{t('search.bestMatch')}</option>
          <option value="price_asc">{t('search.priceAsc')}</option>
          <option value="price_desc">{t('search.priceDesc')}</option>
          <option value="newest">{t('homepage.sections.newOnByb')}</option>
        </select>
      </label>
      <label className="filter-control">{t('search.currency')}
        <select className="filter-select" value={state.currency} disabled={pending} onChange={event => onChange(event.target.value
          ? { currency: event.target.value, minPrice: '', maxPrice: '' }
          : { currency: '', minPrice: '', maxPrice: '', sort: state.sort.startsWith('price_') ? 'relevance' : state.sort })}>
          <option value="">{t('search.allCurrencies')}</option>
          {state.currency && !SEARCH_CURRENCIES.includes(state.currency as typeof SEARCH_CURRENCIES[number]) && <option value={state.currency}>{state.currency}</option>}
          {SEARCH_CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
        </select>
      </label>
      <label className="filter-control">{t('search.category')}
        <select className="filter-select" value={state.category} disabled={pending || !options} onChange={event => onChange({ category: event.target.value })}>
          <option value="">{t('search.allCategories')}</option>
          {state.category && !categories.some(category => category.slug === state.category) && <option value={state.category}>{state.category}</option>}
          {categories.map(category => <option key={category.id} value={category.slug}>{category.name}</option>)}
        </select>
        <span className="filter-hint">{t('search.exactCategory')}</span>
      </label>
      <fieldset disabled={pending} className="filter-control">
        <legend>{t('search.merchants')}</legend>
        {[...merchants, ...state.merchant.filter(code => !merchants.some(merchant => merchant.code === code)).map(code => ({ code, name: code }))].map(merchant =>
          <label key={merchant.code} className="merchant-toggle">
            <input type="checkbox" checked={state.merchant.includes(merchant.code)} onChange={event => onChange({ merchant: event.target.checked
              ? [...state.merchant, merchant.code] : state.merchant.filter(code => code !== merchant.code) })} /><span>{merchant.name}</span>
          </label>
        )}
      </fieldset>
    </div>
    <form key={`${state.currency}:${state.minPrice}:${state.maxPrice}`} className="price-toolbar" onSubmit={event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      try { const patch = pricePatch(String(fields.get('min') || ''), String(fields.get('max') || ''), state.currency); setPriceError(false); onChange(patch); }
      catch { setPriceError(true); }
    }}>
      <label className="filter-control">{t('search.minimumPrice')}
        <input name="min" className="filter-price" type="text" inputMode="decimal" disabled={!state.currency || pending}
          defaultValue={priceInput(state.minPrice, state.currency)} placeholder="0" />
      </label>
      <label className="filter-control">{t('search.maximumPrice')}
        <input name="max" className="filter-price" type="text" inputMode="decimal" disabled={!state.currency || pending}
          defaultValue={priceInput(state.maxPrice, state.currency)} />
      </label>
      <button className="filter-apply" type="submit" disabled={!state.currency || pending}>{t('search.applyPrice')}</button>
    </form>
    {priceError && <p role="alert" className="text-sm text-red-700 mt-2">{t('search.invalidRange')}</p>}
    <p className="currency-note">{t('search.currencyHelp')}</p>
    <div className="active-filters" aria-label={t('search.activeFilters')}>
      {state.merchant.length > 0 && <button type="button" className="active-filter" onClick={() => onChange({ merchant: [] })}>
        {t('search.merchants')}: {state.merchant.map(code => merchants.find(merchant => merchant.code === code)?.name || code).join(', ')} ×
      </button>}
      {state.category && <button type="button" className="active-filter" onClick={() => onChange({ category: '' })}>
        {t('search.category')}: {categories.find(category => category.slug === state.category)?.name || state.category} ×
      </button>}
      {state.currency && <button type="button" className="active-filter" onClick={() => onChange({ currency: '', minPrice: '', maxPrice: '', sort: state.sort.startsWith('price_') ? 'relevance' : state.sort })}>
        {t('search.currency')}: {state.currency} ×
      </button>}
      {(state.minPrice !== '' || state.maxPrice !== '') && <button type="button" className="active-filter" onClick={() => onChange({ minPrice: '', maxPrice: '' })}>
        {t('search.priceRange')}: {state.minPrice !== '' ? priceText(state.minPrice) : '0'} – {state.maxPrice !== '' ? priceText(state.maxPrice) : '∞'} ×
      </button>}
      <button type="button" className="filter-clear" onClick={() => onChange(clearedFilters())}>{t('search.clearFilters')}</button>
    </div>
  </section>;
}
