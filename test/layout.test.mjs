import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileSectionLayout } from '../src/layout.mjs';

function item(id, summary, details = []) {
  return { id, title: id, summary, details };
}

test('imbalanced three-item summary becomes a featured stack', () => {
  const layout = compileSectionLayout({
    id: 'summary',
    kind: 'summary',
    layout: 'auto',
    items: [
      item('dense', 'A long primary item.', [
        'First detailed point with additional explanation.',
        'Second detailed point with additional explanation.',
        'Third detailed point with additional explanation.',
      ]),
      item('short_a', 'Short.'),
      item('short_b', 'Short.'),
    ],
  });
  assert.equal(layout.layout, 'featured-stack');
  assert.equal(layout.featuredIndex, 0);
  assert.ok(layout.weightStats.ratio > 1.45);
});

test('balanced three-item summary becomes three columns', () => {
  const layout = compileSectionLayout({
    id: 'summary',
    kind: 'summary',
    layout: 'auto',
    items: [
      item('one', 'Comparable summary text.'),
      item('two', 'Comparable summary text.'),
      item('three', 'Comparable summary text.'),
    ],
  });
  assert.equal(layout.layout, 'three-column');
});

test('large card collections become compact lists', () => {
  const layout = compileSectionLayout({
    id: 'status',
    kind: 'status',
    layout: 'auto',
    items: Array.from({ length: 7 }, (_, index) => item(`item_${index}`, 'Status summary.')),
  });
  assert.equal(layout.layout, 'compact-list');
});
