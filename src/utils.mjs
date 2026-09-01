import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function readJsonFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Could not read JSON file ${filePath}: ${error.message}`);
  }

  try {
    return { value: JSON.parse(raw), raw };
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeAttribute(value = '') {
  return escapeHtml(value).replaceAll('`', '&#96;');
}

export function jsonForHtml(value) {
  return JSON.stringify(value, null, 2)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

export function sha256Text(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function atomicWriteFile(targetPath, content) {
  const dir = path.dirname(targetPath);
  ensureDir(dir);
  const tmp = path.join(
    dir,
    `.${path.basename(targetPath)}.reportify-${process.pid}-${Date.now()}.tmp`,
  );
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, targetPath);
}

export function copyFileAtomic(sourcePath, targetPath) {
  const content = fs.readFileSync(sourcePath);
  atomicWriteFile(targetPath, content);
}

export function slugify(value, fallback = 'report') {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function findExecutable(candidates) {
  const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) && fs.existsSync(candidate)) return candidate;
    for (const entry of pathEntries) {
      const full = path.join(entry, candidate);
      if (fs.existsSync(full)) return full;
      if (process.platform === 'win32' && fs.existsSync(`${full}.exe`)) return `${full}.exe`;
    }
  }
  return null;
}

export function findChromium() {
  const explicit = process.env.REPORTIFY_CHROME || process.env.CHROME_PATH;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const candidates = process.platform === 'win32'
    ? [
        'chrome.exe',
        'msedge.exe',
        'chromium.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          'google-chrome',
          'chromium',
        ]
      : [
          'chromium',
          'chromium-browser',
          'google-chrome',
          'google-chrome-stable',
        ];

  return findExecutable(candidates);
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function unique(values) {
  return [...new Set(values)];
}

export function countNumericSignals(value) {
  const text = String(value || '');
  const matches = text.match(/(?:\d+(?:[.,]\d+)?\s*%|[$￥€£]\s*[\d,.]+|\d+(?:\.\d+)?\s*(?:倍|x|×)|\b\d{1,3}(?:,\d{3})+\b)/gi);
  return matches?.length || 0;
}

export function looksLikePlaceholder(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return /(?:lorem ipsum|\{\{[^}]+\}\}|\bexample metric\b|\bplaceholder\b|待填写|示例数据)/i.test(text);
}

export function safeHref(location) {
  const value = String(location || '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}
