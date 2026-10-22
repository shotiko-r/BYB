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
  return <fieldset className="product-variations">
    <legend>{t('product.p22.options')}</legend>
    {group.dimensions.filter(dimension => dimension.values.length > 1).map((dimension, index) =>
      <div className="product-variation" key={dimension.name}>
        <label htmlFor={`${id}-${index}`}>{dimension.name}</label>
        <select id={`${id}-${index}`} value={selections[dimension.name] ?? ''} onChange={event =>
          onChange({ ...selections, [dimension.name]: event.target.value })}>
          <option value="">{t('product.p22.choose')}</option>
          {dimension.values.map(value => <option key={value} value={value}
            disabled={!variationOptionEnabled(group, selections, dimension.name, value)}>{value}</option>)}
        </select>
      </div>)}
    <button type="button" onClick={() => onChange({})}>{t('product.p22.reset')}</button>
    <p>{t('product.p22.hint')}</p>
  </fieldset>;
}
