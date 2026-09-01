import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport } from '../src/render.mjs';
import { validateReportSpec } from '../src/validate.mjs';
import { getBrowserCapabilities, visualCheck } from '../src/visual-check.mjs';
import { readJsonFile } from '../src/utils.mjs';

const capabilities = getBrowserCapabilities();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const browserTest = capabilities.pythonPlaywrightAvailable ? test : test.skip;

browserTest('a valid demo passes a real-browser geometry audit', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reportify-browser-good-'));
  try {
    const { value } = readJsonFile(path.join(root, 'examples', 'executive-status.report.json'));
    const validation = validateReportSpec(value, { quality: 'showcase' });
    const htmlPath = path.join(tmp, 'report.html');
    fs.writeFileSync(htmlPath, renderReport(validation.spec).html);
    const receipt = visualCheck(htmlPath, {
      outputDir: path.join(tmp, 'checks'),
      viewports: [{ width: 1280, height: 800, theme: 'light' }],
    });
    assert.equal(receipt.accepted, true, JSON.stringify(receipt, null, 2));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

browserTest('the browser audit detects a tall card with low vertical fill', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reportify-browser-bad-'));
  try {
    const spec = {
      schema_version: 1,
      meta: {
        title: 'Bad layout fixture',
        archetype: 'status',
        locale: 'en',
        quality_profile: 'showcase',
      },
      executive: { answer: 'This fixture is intentionally stretched.', next_action: 'Repair the layout.' },
      sections: [{
        id: 'summary',
        title: 'Summary',
        kind: 'summary',
        layout: 'cards',
        items: [{ id: 'short_item', title: 'Short item', summary: 'Only one short line.' }],
      }],
    };
    const validation = validateReportSpec(spec, { quality: 'showcase' });
    assert.equal(validation.accepted, true);
    let html = renderReport(validation.spec).html;
    html = html.replace('</head>', '<style>.report-card{min-height:520px!important}</style></head>');
    const htmlPath = path.join(tmp, 'bad.html');
    fs.writeFileSync(htmlPath, html);
    const receipt = visualCheck(htmlPath, {
      outputDir: path.join(tmp, 'checks'),
      viewports: [{ width: 1280, height: 800, theme: 'light' }],
    });
    assert.equal(receipt.accepted, false);
    assert.ok(receipt.warnings.some((entry) => entry.code === 'LOW_VERTICAL_FILL'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
