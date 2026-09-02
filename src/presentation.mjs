import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRESENTATION_CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'report-presentation.css'), 'utf8');
const PRESENTATION_JS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'report-presentation.js'), 'utf8');

export function enhancePresentation(html) {
  if (typeof html !== 'string' || !html.includes('</head>') || !html.includes('</body>')) {
    throw new Error('Reportify presentation enhancement requires a complete HTML document.');
  }
  if (html.includes('id="reportify-presentation-style"') || html.includes('id="reportify-presentation-runtime"')) {
    return html;
  }

  const normalized = html.replace(
    /<meta name="generator" content="Reportify [^"]+">/i,
    '<meta name="generator" content="Reportify 0.2.0 presentation">',
  );

  const withStyle = normalized.replace(
    '</head>',
    `<style id="reportify-presentation-style">${PRESENTATION_CSS}</style>\n</head>`,
  );
  return withStyle.replace(
    '</body>',
    `<script id="reportify-presentation-runtime">${PRESENTATION_JS}</script>\n</body>`,
  );
}

export function checkPresentationHtml(html) {
  const errors = [];
  const required = [
    'id="reportify-presentation-style"',
    'id="reportify-presentation-runtime"',
    'ReportifyPresentation',
    'PAGE_COUNT_MISMATCH',
    'PAGE_VERTICAL_OVERFLOW',
    'ORPHAN_GRID_ITEM',
  ];
  for (const marker of required) {
    if (!html.includes(marker)) {
      errors.push({ code: 'MISSING_PRESENTATION_CONTRACT', message: `Presentation HTML is missing ${marker}.` });
    }
  }
  return { valid: errors.length === 0, errors };
}
