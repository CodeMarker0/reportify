import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  atomicWriteFile,
  ensureDir,
  findChromium,
  findExecutable,
  slugify,
} from './utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_AUDIT_SCRIPT = path.join(__dirname, '..', 'scripts', 'browser_audit.py');

export const DEFAULT_VIEWPORTS = [
  { width: 1440, height: 900, theme: 'light' },
  { width: 1600, height: 1000, theme: 'light' },
  { width: 1920, height: 1080, theme: 'dark' },
  { width: 2048, height: 1320, theme: 'light' },
  { width: 390, height: 844, theme: 'light' },
];

function findPythonPlaywright() {
  for (const python of ['python3', 'python']) {
    const executable = findExecutable([python]);
    if (!executable) continue;
    const probe = spawnSync(executable, ['-c', 'import playwright'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    if (probe.status === 0) return executable;
  }
  return null;
}

function extractAuditReceipt(dom) {
  const match = dom.match(/<script[^>]*id=["']reportify-audit-result["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  const raw = match[1]
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Could not parse browser audit receipt: ${error.message}`);
  }
}

function runWithPythonPlaywright(python, chrome, htmlPath, outputDir, matrix) {
  const args = [
    PYTHON_AUDIT_SCRIPT,
    path.resolve(htmlPath),
    path.resolve(outputDir),
    '--matrix',
    JSON.stringify(matrix),
  ];
  if (chrome) args.push('--chrome', chrome);

  const result = spawnSync(python, args, {
    encoding: 'utf8',
    maxBuffer: 60 * 1024 * 1024,
    timeout: 180_000,
  });
  if (result.error) throw new Error(`Playwright browser audit failed: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`Playwright browser audit exited with status ${result.status}: ${(result.stderr || '').trim().slice(0, 1600)}`);
  }
  try {
    const parsed = JSON.parse(result.stdout || '{}');
    return parsed.results || [];
  } catch (error) {
    throw new Error(`Could not parse Playwright audit output: ${error.message}`);
  }
}

function runOneChromiumCli(chrome, htmlPath, outputDir, viewport) {
  const name = `${viewport.width}x${viewport.height}-${viewport.theme}`;
  const screenshotPath = path.join(outputDir, `${name}.png`);
  const url = pathToFileURL(path.resolve(htmlPath));
  url.searchParams.set('theme', viewport.theme);
  url.searchParams.set('reportify_audit', '1');
  const profileDir = path.join(outputDir, `.chrome-profile-${name}`);

  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--run-all-compositor-stages-before-draw',
    '--force-device-scale-factor=1',
    '--virtual-time-budget=2200',
    `--user-data-dir=${profileDir}`,
    `--window-size=${viewport.width},${viewport.height}`,
    `--screenshot=${screenshotPath}`,
    '--dump-dom',
    url.href,
  ];

  const result = spawnSync(chrome, args, {
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
    timeout: 20_000,
  });
  fs.rmSync(profileDir, { recursive: true, force: true });

  if (result.error) {
    return { accepted: false, viewport, screenshot: null, error: `Chromium execution failed: ${result.error.message}` };
  }
  if (result.status !== 0) {
    return {
      accepted: false,
      viewport,
      screenshot: fs.existsSync(screenshotPath) ? screenshotPath : null,
      error: `Chromium exited with status ${result.status}: ${(result.stderr || '').trim().slice(0, 1200)}`,
    };
  }

  let audit;
  try {
    audit = extractAuditReceipt(result.stdout || '');
  } catch (error) {
    return { accepted: false, viewport, screenshot: fs.existsSync(screenshotPath) ? screenshotPath : null, error: error.message };
  }
  if (!audit) {
    return {
      accepted: false,
      viewport,
      screenshot: fs.existsSync(screenshotPath) ? screenshotPath : null,
      error: 'Browser did not emit a Reportify audit receipt.',
    };
  }
  return { accepted: Boolean(audit.accepted), viewport, screenshot: screenshotPath, audit };
}

function createContactSheet(screenshots, outputDir) {
  const montage = findExecutable(['montage', 'magick']);
  if (!montage || screenshots.length === 0) return null;
  const output = path.join(outputDir, 'contact-sheet.png');
  const args = montage.endsWith('magick')
    ? ['montage', ...screenshots, '-thumbnail', '900x900>', '-tile', '2x', '-geometry', '+12+12', '-background', '#eef1f5', output]
    : [...screenshots, '-thumbnail', '900x900>', '-tile', '2x', '-geometry', '+12+12', '-background', '#eef1f5', output];
  const result = spawnSync(montage, args, { encoding: 'utf8', timeout: 60_000 });
  return result.status === 0 && fs.existsSync(output) ? output : null;
}

export function getBrowserCapabilities() {
  const chrome = findChromium();
  const python = findPythonPlaywright();
  return {
    chromium: chrome,
    chromiumAvailable: Boolean(chrome),
    pythonPlaywright: python,
    pythonPlaywrightAvailable: Boolean(python),
    acceptedBrowserPathAvailable: Boolean(python || chrome),
  };
}

export function visualCheck(htmlPath, options = {}) {
  const resolvedHtml = path.resolve(htmlPath);
  if (!fs.existsSync(resolvedHtml)) {
    return {
      accepted: false,
      browser: null,
      visualReview: 'not-run',
      errors: [{ code: 'MISSING_ARTIFACT', message: `HTML file not found: ${resolvedHtml}` }],
      warnings: [],
      results: [],
    };
  }

  const chrome = options.chrome || findChromium();
  const python = options.python || findPythonPlaywright();
  if (!python && !chrome) {
    return {
      accepted: false,
      browser: null,
      visualReview: 'not-run',
      errors: [{ code: 'BROWSER_UNAVAILABLE', message: 'Neither Python Playwright nor Chromium/Chrome was found.' }],
      warnings: [],
      results: [],
    };
  }

  const outputDir = path.resolve(
    options.outputDir || path.join(
      path.dirname(resolvedHtml),
      `${slugify(path.basename(resolvedHtml, path.extname(resolvedHtml)))}.reportify-checks`,
    ),
  );
  ensureDir(outputDir);
  const matrix = options.viewports || DEFAULT_VIEWPORTS;

  let results;
  let browserPath;
  try {
    if (python) {
      results = runWithPythonPlaywright(python, chrome, resolvedHtml, outputDir, matrix);
      browserPath = `Python Playwright (${python})${chrome ? ` → ${chrome}` : ''}`;
    } else {
      results = matrix.map((viewport) => runOneChromiumCli(chrome, resolvedHtml, outputDir, viewport));
      browserPath = `Chromium CLI (${chrome})`;
    }
  } catch (error) {
    return {
      accepted: false,
      browser: python ? `Python Playwright (${python})` : chrome,
      visualReview: 'not-run',
      errors: [{ code: 'BROWSER_CHECK_FAILED', message: error.message }],
      warnings: [],
      results: [],
      outputDir,
      contactSheet: null,
    };
  }

  const errors = [];
  const warnings = [];
  for (const result of results) {
    const label = `${result.viewport.width}x${result.viewport.height}-${result.viewport.theme}`;
    if (result.error) {
      errors.push({ code: 'BROWSER_CHECK_FAILED', viewport: label, message: result.error });
      continue;
    }
    for (const entry of result.audit?.errors || []) errors.push({ ...entry, viewport: label });
    for (const entry of result.audit?.warnings || []) warnings.push({ ...entry, viewport: label });
  }

  const screenshots = results.map((result) => result.screenshot).filter(Boolean);
  const contactSheet = createContactSheet(screenshots, outputDir);
  const accepted = results.length === matrix.length && results.every((result) => result.accepted);
  const receipt = {
    auditVersion: 1,
    artifact: resolvedHtml,
    browser: browserPath,
    accepted,
    visualReview: screenshots.length ? 'pending' : 'not-run',
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
    results,
    outputDir,
    contactSheet,
  };
  atomicWriteFile(path.join(outputDir, 'visual-check.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}
