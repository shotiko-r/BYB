'use client';

import { useId } from 'react';
import type { VariationGroup } from '@byb/shared/types';
import { variationOptionEnabled } from '@/lib/product-variations';
import { useI18n } from '@/i18n/I18nContext';

export function ProductVariations({ group, selections, onChange }: {
  group: VariationGroup; selections: Record<string, string>; onChange: (selections: Record<string, string>) => void;
}) {
  const id = useId();
  const { t } = useI18n();
  const dimensions = group.dimensions.filter(dimension => dimension.values.length > 1);
  if (!dimensions.length) return null;
  return <fieldset className="product-variations" aria-describedby={`${id}-hint`}>
    <legend>{t('product.p22.options')}</legend>
    <div className="product-variation-grid">
      {dimensions.map((dimension, index) => <div className="product-variation" key={dimension.name}>
        <label htmlFor={`${id}-${index}`}>{dimension.name}</label>
        <select id={`${id}-${index}`} value={selections[dimension.name] ?? ''} onChange={event =>
          onChange({ ...selections, [dimension.name]: event.target.value })}>
          <option value="">{t('product.p22.choose')}</option>
          {dimension.values.map(value => <option key={value} value={value}
            disabled={!variationOptionEnabled(group, selections, dimension.name, value)}>{value}</option>)}
        </select>
      </div>)}
    </div>
    <div className="product-variation-footer">
      <button type="button" onClick={() => onChange({})}>{t('product.p22.reset')}</button>
      <p id={`${id}-hint`}>{t('product.p22.hint')}</p>
    </div>
  </fieldset>;
}
