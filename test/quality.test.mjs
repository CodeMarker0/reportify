import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compileSectionLayout, estimateItemWeight, selectFeaturedIndex } from '../src/layout.mjs';
import { renderReport, checkRenderedHtml } from '../src/render.mjs';
import { enhancePresentation } from '../src/presentation.mjs';
import { findChromium, findExecutable } from '../src/utils.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const short = { id: 'decision', title: 'Approve the next validation step', summary: 'Keep the current API contract.', emphasis: true, priority: 'P0' };
const long = { id: 'background', title: 'Background', summary: 'Additional context. '.repeat(25) };

test('semantic emphasis wins over text volume in a featured composition', () => {
  const result = compileSectionLayout({ id: 'focus', kind: 'summary', items: [long, short] });
  assert.equal(result.layout, 'featured-stack');
  assert.equal(result.featuredIndex, 1);
  assert.equal(result.featuredPlacement, 'lead-strip');
  assert.ok(result.itemWeights[0] > result.itemWeights[1]);
  assert.equal(estimateItemWeight(short), estimateItemWeight({ ...short, emphasis: false }));
});

test('featured precedence is explicit emphasis, recommendation, priority, then source order', () => {
  assert.equal(selectFeaturedIndex([]), null);
  assert.equal(selectFeaturedIndex([long, { ...short, emphasis: false }]), 1);
  assert.equal(selectFeaturedIndex([{ priority: 'P2' }, { priority: 'P0' }, { priority: 'P1' }]), 1);
  assert.equal(selectFeaturedIndex([{ priority: 'P0' }, { recommended: true }]), 1);
  assert.equal(selectFeaturedIndex([{ recommended: true }, { emphasis: true }]), 1);
  assert.equal(selectFeaturedIndex([{ title: 'First' }, long]), 0);
  assert.equal(selectFeaturedIndex([{ emphasis: true }, { emphasis: true }]), 0);
});

function fixture(density = 'balanced', theme = 'executive-blue') {
  const item = (prefix, index) => ({ id: `${prefix}-${index}`, title: `${prefix} ${index + 1}`, summary: 'One concise, verifiable point.' });
  return {
    schema_version: 1,
    meta: { title: 'Reportify quality regression', subtitle: 'Synthetic fixture — not operational metrics.', archetype: 'research', audience: 'mixed', locale: 'en', theme, density, quality_profile: 'showcase' },
    executive: { answer: 'Prioritize meaning, readable type, and predictable navigation.', scope: 'A deterministic browser test fixture.', next_action: 'Run the regression suite before changing layout.' },
    metrics: [{ id: 'mode', label: 'Validation state', value: 'Test fixture', evidence_ref: 's0' }],
    sections: [
      { id: 'overview', title: 'Semantic hierarchy', kind: 'summary', items: [long, short, { ...item('support', 0), summary: 'Supporting detail stays secondary.' }] },
      { id: 'cards', title: 'Balanced card collection', kind: 'summary', items: Array.from({ length: 5 }, (_, i) => item('card', i)) },
      { id: 'findings', title: 'Evidence-backed findings', kind: 'findings', items: Array.from({ length: 6 }, (_, i) => ({ ...item('finding', i), evidence_ref: 's6' })) },
      { id: 'timeline', title: 'Ordered milestones', kind: 'timeline', items: Array.from({ length: 6 }, (_, i) => item('milestone', i)) },
      { id: 'inventory', title: 'Structured inventory', kind: 'table', columns: [{ key: 'name', label: 'Name' }, { key: 'description', label: 'Description' }], rows: Array.from({ length: 9 }, (_, i) => ({ name: `Record ${i + 1}`, description: 'A safely scrollable table row.' })) },
      { id: 'comparison', title: 'Shared evaluation criteria', kind: 'comparison', layout: 'cards', criteria: [{ id: 'fit', label: 'Fit' }], items: [0, 1].map((i) => ({ ...item('option', i), values: { fit: 'Suitable for this fixture' }, recommended: i === 0 })) },
      { id: 'flow', title: 'Delivery path', kind: 'flow', items: [0, 1, 2].map((i) => item('step', i)) },
      { id: 'notes', title: 'Limitations', kind: 'text', content: 'This fixture checks behavior and geometry. It is not a claim that all possible reports are aesthetically perfect.' },
    ],
    sources: Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, label: `Fixture source ${i + 1}`, location: `quality-fixture.txt, section ${i + 1}`, note: 'Synthetic test input.' })),
  };
}

test('density is explicit in the HTML and omission remains balanced', () => {
  for (const density of ['compact', 'balanced', 'spacious']) {
    const output = renderReport(fixture(density));
    assert.ok(output.html.includes(`data-density="${density}"`));
    assert.equal(checkRenderedHtml(output.html).valid, true);
  }
  const spec = fixture();
  delete spec.meta.density;
  assert.ok(renderReport(spec).html.includes('data-density="balanced"'));
});

test('compact-strip overrides never silently discard additional source items', () => {
  const spec = fixture();
  spec.sections = [{ id: 'multi', title: 'Two facts', kind: 'summary', layout: 'compact-strip', items: [{ id: 'a', title: 'First fact', summary: 'Retained A.' }, { id: 'b', title: 'Second fact', summary: 'Retained B.' }] }];
  const { html } = renderReport(spec);
  assert.equal((html.match(/class="compact-strip"/g) || []).length, 2);
  assert.match(html, /<h3 data-check-text>Second fact<\/h3>/);
});

const python = ['python3', 'python'].map((name) => findExecutable([name])).find((executable) => executable && spawnSync(executable, ['-c', 'import playwright'], { timeout: 10_000 }).status === 0);

test('real-browser density, contrast, geometry and presentation interactions', { skip: !python && !process.env.REPORTIFY_REQUIRE_BROWSER, timeout: 180_000 }, () => {
  assert.ok(python, 'Python Playwright is required; install scripts/requirements.txt and chromium.');
  const keep = process.env.REPORTIFY_TEST_OUTPUT;
  const dir = keep ? path.resolve(keep) : fs.mkdtempSync(path.join(os.tmpdir(), 'reportify-quality-'));
  fs.mkdirSync(dir, { recursive: true });
  try {
    for (const theme of ['executive-blue', 'paper', 'midnight']) {
      for (const density of ['compact', 'balanced', 'spacious']) {
        const spec = fixture(density, theme);
        const { html } = renderReport(spec);
        fs.writeFileSync(path.join(dir, `${theme}-${density}.html`), html);
        fs.writeFileSync(path.join(dir, `${theme}-${density}.paged.html`), enhancePresentation(html));
      }
    }
    const zh = fixture();
    zh.meta.locale = 'zh-CN';
    zh.meta.title = '布局与交互回归验证';
    zh.meta.subtitle = '合成测试材料，不代表真实业务指标。';
    zh.executive.answer = '突出重点，保持文字清晰，确保翻页行为可预测。';
    zh.executive.next_action = '修改布局后运行浏览器回归测试。';
    zh.sections[0].items[0].summary = '这是用于测试中文换行与空间分配的背景说明，不代表真实业务结论。'.repeat(8);
    zh.sections[0].items[1].title = '优先验证核心结论';
    const zhHtml = renderReport(zh).html;
    fs.writeFileSync(path.join(dir, 'zh-CN-balanced.html'), zhHtml);
    fs.writeFileSync(path.join(dir, 'zh-CN-balanced.paged.html'), enhancePresentation(zhHtml));
    const args = [path.join(root, 'scripts', 'quality_regression.py'), dir];
    const chrome = findChromium();
    if (chrome) args.push('--chrome', chrome);
    const run = spawnSync(python, args, { encoding: 'utf8', timeout: 165_000, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(run.status, 0, run.error?.message || run.stderr || run.stdout);
    const receipt = JSON.parse(run.stdout);
    assert.equal(receipt.accepted, true);
    console.log(`Browser regression: ${receipt.pageAudits} page audits, ${receipt.assertions} assertions; ${receipt.screenshots.length} screenshots.`);
  } finally {
    if (!keep) fs.rmSync(dir, { recursive: true, force: true });
  }
});
