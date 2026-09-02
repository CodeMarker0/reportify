import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile, ensureDir, findChromium, findExecutable, slugify } from './utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_SCRIPT = path.join(__dirname, '..', 'scripts', 'presentation_audit.py');

export const DEFAULT_PRESENTATION_VIEWPORTS = [
  { width: 1440, height: 900, theme: 'light' },
  { width: 1920, height: 1080, theme: 'dark' },
  { width: 390, height: 844, theme: 'light' },
];

function findPythonPlaywright() {
  for (const candidate of ['python3', 'python']) {
    const python = findExecutable([candidate]);
    if (!python) continue;
    const probe = spawnSync(python, ['-c', 'import playwright'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    if (probe.status === 0) return python;
  }
  return null;
}

function createContactSheet(screenshots, outputDir) {
  if (!screenshots.length) return null;
  const montage = findExecutable(['montage', 'magick']);
  if (!montage) return null;
  const output = path.join(outputDir, 'presentation-contact-sheet.png');
  const args = montage.endsWith('magick')
    ? ['montage', ...screenshots, '-thumbnail', '640x420>', '-tile', '3x', '-geometry', '+10+10', '-background', '#eef1f5', output]
    : [...screenshots, '-thumbnail', '640x420>', '-tile', '3x', '-geometry', '+10+10', '-background', '#eef1f5', output];
  const result = spawnSync(montage, args, { encoding: 'utf8', timeout: 90_000 });
  return result.status === 0 && fs.existsSync(output) ? output : null;
}

export function getPresentationCapabilities() {
  const python = findPythonPlaywright();
  const chromium = findChromium();
  return {
    pythonPlaywright: python,
    pythonPlaywrightAvailable: Boolean(python),
    chromium,
    chromiumAvailable: Boolean(chromium),
    pageByPageAuditAvailable: Boolean(python),
  };
}

export function presentationCheck(htmlPath, options = {}) {
  const resolvedHtml = path.resolve(htmlPath);
  const outputDir = path.resolve(
    options.outputDir || path.join(
      path.dirname(resolvedHtml),
      `${slugify(path.basename(resolvedHtml, path.extname(resolvedHtml)))}.reportify-presentation-checks`,
    ),
  );
  ensureDir(outputDir);

  if (!fs.existsSync(resolvedHtml)) {
    return {
      accepted: false,
      errors: [{ code: 'MISSING_ARTIFACT', message: `HTML file not found: ${resolvedHtml}` }],
      warnings: [],
      results: [],
      outputDir,
    };
  }

  const python = options.python || findPythonPlaywright();
  const chromium = options.chrome || findChromium();
  if (!python) {
    return {
      accepted: false,
      browser: chromium || null,
      errors: [{
        code: 'PRESENTATION_BROWSER_UNAVAILABLE',
        message: 'Python Playwright is required for page-by-page presentation acceptance. Install it with: python -m pip install playwright',
      }],
      warnings: [],
      results: [],
      outputDir,
      contactSheet: null,
    };
  }

  const matrix = options.viewports || DEFAULT_PRESENTATION_VIEWPORTS;
  const args = [
    PYTHON_SCRIPT,
    resolvedHtml,
    outputDir,
    '--matrix',
    JSON.stringify(matrix),
  ];
  if (chromium) args.push('--chrome', chromium);

  const result = spawnSync(python, args, {
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    timeout: 240_000,
  });
  if (result.error || result.status !== 0) {
    return {
      accepted: false,
      browser: `Python Playwright (${python})`,
      errors: [{
        code: 'PRESENTATION_BROWSER_CHECK_FAILED',
        message: result.error?.message || `Presentation audit exited with status ${result.status}: ${(result.stderr || '').trim().slice(0, 1600)}`,
      }],
      warnings: [],
      results: [],
      outputDir,
      contactSheet: null,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch (error) {
    return {
      accepted: false,
      browser: `Python Playwright (${python})`,
      errors: [{ code: 'PRESENTATION_AUDIT_PARSE_FAILED', message: error.message }],
      warnings: [],
      results: [],
      outputDir,
      contactSheet: null,
    };
  }

  const results = parsed.results || [];
  const errors = [];
  const warnings = [];
  const screenshots = [];
  for (const viewportResult of results) {
    const viewportLabel = `${viewportResult.viewport?.width}x${viewportResult.viewport?.height}-${viewportResult.viewport?.theme}`;
    if (viewportResult.error) {
      errors.push({ code: 'PRESENTATION_BROWSER_CHECK_FAILED', viewport: viewportLabel, message: viewportResult.error });
      continue;
    }
    for (const pageResult of viewportResult.pages || []) {
      if (pageResult.screenshot) screenshots.push(pageResult.screenshot);
      const pageLabel = `${pageResult.page}/${pageResult.pageCount}`;
      for (const entry of pageResult.audit?.errors || []) errors.push({ ...entry, viewport: viewportLabel, page: pageLabel });
      for (const entry of pageResult.audit?.warnings || []) warnings.push({ ...entry, viewport: viewportLabel, page: pageLabel });
    }
  }

  const accepted = results.length === matrix.length && results.every((entry) => entry.accepted);
  const contactSheet = createContactSheet(screenshots, outputDir);
  const receipt = {
    auditVersion: 2,
    artifact: resolvedHtml,
    browser: `Python Playwright (${python})${chromium ? ` → ${chromium}` : ''}`,
    accepted,
    pageByPage: true,
    viewportCount: results.length,
    pageScreenshotCount: screenshots.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
    results,
    outputDir,
    contactSheet,
  };
  atomicWriteFile(path.join(outputDir, 'presentation-check.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}
