import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../src/i18n/I18nContext';
import { ProductDescription } from '../src/components/ProductDescription';
import { parseProductDescription, previewProductDescription } from '../src/lib/product-description';

const render = (view: React.ReactNode) => renderToStaticMarkup(<I18nProvider>{view}</I18nProvider>);

test('description parser preserves paragraphs, bullet lists and safe section headings', () => {
  const blocks = parseProductDescription('OVERVIEW\n\nWireless headphones.\n\nSpecifications:\n- Bluetooth 5.3\n- 30 hour battery\n\nCondition: Open box');
  assert.deepEqual(blocks, [
    { type: 'heading', text: 'OVERVIEW' },
    { type: 'paragraph', text: 'Wireless headphones.' },
    { type: 'heading', text: 'Specifications:' },
    { type: 'list', items: ['Bluetooth 5.3', '30 hour battery'] },
    { type: 'paragraph', text: 'Condition: Open box' },
  ]);
});

test('long descriptions preview without losing content when expanded', () => {
  const text = Array.from({ length: 30 }, (_, index) => `Paragraph ${index} ${'detail '.repeat(18)}`).join('\n\n');
  const blocks = parseProductDescription(text);
  const preview = previewProductDescription(blocks);
  assert.ok(preview.hasMore);
  assert.ok(preview.blocks.length < blocks.length);
  const collapsed = render(<ProductDescription text={text} />);
  const expanded = render(<ProductDescription text={text} initiallyExpanded />);
  assert.ok(collapsed.includes('Show more'));
  assert.ok(!collapsed.includes('Paragraph 29'));
  assert.ok(expanded.includes('Show less'));
  assert.ok(expanded.includes('Paragraph 29'));
  assert.ok(collapsed.includes('aria-expanded="false"'));
  assert.ok(expanded.includes('aria-expanded="true"'));
});

test('pathological block counts keep the remaining description text', () => {
  const text = Array.from({ length: 120 }, (_, index) => `Line ${index}`).join('\n\n');
  const blocks = parseProductDescription(text);
  assert.equal(blocks.length, 81);
  const last = blocks.at(-1);
  assert.equal(last?.type, 'paragraph');
  if (last?.type === 'paragraph') assert.ok(last.text.includes('Line 119'));
});

test('description headings and list items render as escaped text', () => {
  const html = render(<ProductDescription text={'<b>Details</b>:\n- <script>alert(1)</script>\n- Second'} />);
  assert.ok(html.includes('&lt;b&gt;Details&lt;/b&gt;:'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
});
