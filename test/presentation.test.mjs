import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enhancePresentation, checkPresentationHtml } from '../src/presentation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

test('presentation enhancement injects a self-contained paging runtime', () => {
  const source = '<!doctype html><html><head></head><body><main class="report-main"><section class="report-section" id="one"></section></main></body></html>';
  const enhanced = enhancePresentation(source);
  assert.match(enhanced, /id="reportify-presentation-style"/);
  assert.match(enhanced, /id="reportify-presentation-runtime"/);
  assert.match(enhanced, /ReportifyPresentation/);
  assert.equal(checkPresentationHtml(enhanced).valid, true);
});

test('presentation enhancement is idempotent', () => {
  const source = '<!doctype html><html><head></head><body><main class="report-main"></main></body></html>';
  const once = enhancePresentation(source);
  const twice = enhancePresentation(once);
  assert.equal(twice, once);
});

test('presentation runtime contains page compiler and navigation quality gates', () => {
  const runtime = fs.readFileSync(path.join(root, 'assets', 'report-presentation.js'), 'utf8');
  assert.match(runtime, /compilePages/);
  assert.match(runtime, /PAGE_COUNT_MISMATCH/);
  assert.match(runtime, /PAGE_VERTICAL_OVERFLOW/);
  assert.match(runtime, /ORPHAN_GRID_ITEM/);
  assert.match(runtime, /ArrowRight/);
  assert.match(runtime, /touchstart/);
});
