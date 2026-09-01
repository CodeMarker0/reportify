import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonFile } from '../src/utils.mjs';
import { validateReportSpec } from '../src/validate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

for (const name of [
  'executive-status.report.json',
  'decision-brief.report.json',
  'research-summary.report.json',
]) {
  test(`${name} passes showcase validation`, () => {
    const { value } = readJsonFile(path.join(root, 'examples', name));
    const result = validateReportSpec(value, { quality: 'showcase' });
    assert.equal(result.accepted, true, JSON.stringify(result, null, 2));
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, 0);
  });
}

test('showcase rejects an unsupported headline number', () => {
  const spec = {
    schema_version: 1,
    meta: { title: 'Status', archetype: 'status' },
    executive: { answer: 'Current state is known.', next_action: 'Review.' },
    metrics: [{ id: 'metric_one', value: '95%', label: 'Coverage' }],
    sections: [{
      id: 'summary',
      title: 'Summary',
      kind: 'summary',
      items: [{ id: 'item_one', title: 'Result', summary: 'A supported statement.' }],
    }],
  };
  const showcase = validateReportSpec(spec, { quality: 'showcase' });
  assert.equal(showcase.valid, true);
  assert.equal(showcase.accepted, false);
  assert.ok(showcase.warnings.some((entry) => entry.code === 'UNSUPPORTED_HEADLINE_NUMBER'));

  const standard = validateReportSpec(spec, { quality: 'standard' });
  assert.equal(standard.accepted, true);
});

test('broken evidence references are errors', () => {
  const spec = {
    schema_version: 1,
    meta: { title: 'Status', archetype: 'status' },
    executive: { answer: 'Current state is known.', next_action: 'Review.' },
    sections: [{
      id: 'summary',
      title: 'Summary',
      kind: 'summary',
      items: [{ id: 'item_one', title: 'Result', summary: 'Claim.', evidence_ref: 'missing_source' }],
    }],
  };
  const result = validateReportSpec(spec, { quality: 'standard' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === 'BROKEN_EVIDENCE_REF'));
});

test('unknown fields are rejected to keep the IR typed', () => {
  const spec = {
    schema_version: 1,
    meta: { title: 'Status', archetype: 'status', made_up_style: 'glass' },
    executive: { answer: 'Current state is known.', next_action: 'Review.' },
    sections: [{
      id: 'summary',
      title: 'Summary',
      kind: 'summary',
      items: [{ id: 'item_one', title: 'Result', summary: 'Claim.' }],
    }],
  };
  const result = validateReportSpec(spec, { quality: 'standard' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === 'UNKNOWN_FIELD'));
});
