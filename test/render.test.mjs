import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonFile } from '../src/utils.mjs';
import { validateReportSpec } from '../src/validate.mjs';
import { checkRenderedHtml, renderReport } from '../src/render.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const { value } = readJsonFile(path.join(root, 'examples', 'executive-status.report.json'));
const validation = validateReportSpec(value, { quality: 'showcase' });

test('unchanged input produces deterministic HTML', () => {
  const first = renderReport(validation.spec);
  const second = renderReport(validation.spec);
  assert.equal(first.html, second.html);
  assert.deepEqual(first.layoutReceipt, second.layoutReceipt);
});

test('rendered HTML contains the source, layout, and audit contracts', () => {
  const rendered = renderReport(validation.spec);
  assert.match(rendered.html, /id="reportify-source"/);
  assert.match(rendered.html, /id="reportify-layout-receipt"/);
  assert.match(rendered.html, /window\.Reportify/);
  assert.match(rendered.html, /data-report-block/);
  assert.match(rendered.html, /data-block-content/);
  assert.equal(checkRenderedHtml(rendered.html).valid, true);
});

test('ordinary report cards use content height, while comparison equal height is scoped', () => {
  const rendered = renderReport(validation.spec).html;
  const ordinaryRule = rendered.match(/\.report-card\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.match(ordinaryRule, /height:\s*auto/);
  assert.doesNotMatch(ordinaryRule, /height:\s*100%/);
  assert.match(rendered, /\.comparison-card-grid > \.report-card/);
});

test('the imbalanced overview is compiled as a featured stack', () => {
  const rendered = renderReport(validation.spec);
  const overview = rendered.layoutReceipt.sections.find((entry) => entry.sectionId === 'overview');
  assert.equal(overview.layout, 'featured-stack');
  assert.match(rendered.html, /class="featured-layout"/);
});
