#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'SKILL.md',
  'README.md',
  'LICENSE',
  'package.json',
  'schemas/report.schema.json',
  'bin/reportify.mjs',
  'src/validate.mjs',
  'src/layout.mjs',
  'src/render.mjs',
  'src/visual-check.mjs',
  'assets/report-base.css',
  'assets/report-runtime.js',
  'references/authoring-contract.md',
  'references/layout-contract.md',
  'references/delivery-contract.md',
];

const errors = [];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) errors.push(`missing ${relative}`);
}

const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
if (!skill.startsWith('---\n')) errors.push('SKILL.md must start with YAML frontmatter');
if (!/^name:\s*reportify\s*$/m.test(skill)) errors.push('SKILL.md frontmatter name must be reportify');
if (!/^description:\s*\S+/m.test(skill)) errors.push('SKILL.md must include a description');

for (const relative of ['package.json', 'schemas/report.schema.json']) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  } catch (error) {
    errors.push(`${relative} is invalid JSON: ${error.message}`);
  }
}

for (const filename of fs.readdirSync(path.join(root, 'examples')).filter((name) => name.endsWith('.json'))) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, 'examples', filename), 'utf8'));
  } catch (error) {
    errors.push(`examples/${filename} is invalid JSON: ${error.message}`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`error: ${error}`);
  process.exit(1);
}
console.log(`Reportify skill structure is valid (${required.length} required files checked).`);
