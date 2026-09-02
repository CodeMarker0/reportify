#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { renderReport, checkRenderedHtml } from '../src/render.mjs';
import { validateReportSpec } from '../src/validate.mjs';
import { enhancePresentation, checkPresentationHtml } from '../src/presentation.mjs';
import { presentationCheck } from '../src/presentation-check.mjs';
import { atomicWriteFile, ensureDir, readJsonFile, sha256File } from '../src/utils.mjs';

function usage() {
  return `Reportify presentation delivery\n\nUsage:\n  node bin/reportify-present.mjs <report.json> <output.html> [--quality showcase|standard] [--json]\n`;
}

function parseArgs(argv) {
  const positional = [];
  let quality = 'showcase';
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--quality') {
      quality = argv[index + 1] || quality;
      index += 1;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--help' || arg === '-h') {
      return { help: true, positional, quality, json };
    } else {
      positional.push(arg);
    }
  }
  return { help: false, positional, quality, json };
}

function emit(payload, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  if (payload.ok) {
    process.stdout.write(`Reportify presentation delivered: ${payload.output}\n`);
    process.stdout.write(`Pages/screenshots: ${payload.presentation.pageScreenshotCount}\n`);
    process.stdout.write('Browser acceptance: passed\n');
    if (payload.presentation.contactSheet) process.stdout.write(`Contact sheet: ${payload.presentation.contactSheet}\n`);
  } else {
    process.stderr.write(`Reportify presentation delivery failed: ${payload.stage}\n`);
    for (const entry of payload.errors || []) process.stderr.write(`- ${entry.code || 'ERROR'}: ${entry.message}\n`);
    for (const entry of payload.warnings || []) process.stderr.write(`- ${entry.code || 'WARNING'}: ${entry.message}\n`);
    if (payload.candidate) process.stderr.write(`Candidate preserved: ${payload.candidate}\n`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.positional.length < 2) {
    process.stdout.write(usage());
    process.exitCode = args.help ? 0 : 2;
    return;
  }

  const [inputPath, outputPath] = args.positional.map((value) => path.resolve(value));
  let input;
  try {
    input = readJsonFile(inputPath).value;
  } catch (error) {
    emit({ ok: false, stage: 'read', errors: [{ code: 'READ_FAILED', message: error.message }], warnings: [] }, args.json);
    process.exitCode = 2;
    return;
  }

  const validation = validateReportSpec(input, { quality: args.quality });
  if (!validation.accepted) {
    emit({ ok: false, stage: 'validation', errors: validation.errors, warnings: validation.warnings, validation }, args.json);
    process.exitCode = 3;
    return;
  }

  const rendered = renderReport(validation.spec);
  const renderCheck = checkRenderedHtml(rendered.html);
  if (!renderCheck.valid) {
    emit({ ok: false, stage: 'render-contract', errors: renderCheck.errors, warnings: renderCheck.warnings }, args.json);
    process.exitCode = 4;
    return;
  }

  let presentationHtml;
  try {
    presentationHtml = enhancePresentation(rendered.html);
  } catch (error) {
    emit({ ok: false, stage: 'presentation-render', errors: [{ code: 'PRESENTATION_RENDER_FAILED', message: error.message }], warnings: [] }, args.json);
    process.exitCode = 5;
    return;
  }

  const presentationContract = checkPresentationHtml(presentationHtml);
  if (!presentationContract.valid) {
    emit({ ok: false, stage: 'presentation-contract', errors: presentationContract.errors, warnings: [] }, args.json);
    process.exitCode = 6;
    return;
  }

  ensureDir(path.dirname(outputPath));
  const candidate = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.reportify-presentation-candidate-${process.pid}-${Date.now()}.html`,
  );
  fs.writeFileSync(candidate, presentationHtml, 'utf8');

  const receipt = presentationCheck(candidate, {
    outputDir: path.join(
      path.dirname(outputPath),
      `${path.basename(outputPath, path.extname(outputPath))}.reportify-presentation-checks`,
    ),
  });

  if (!receipt.accepted) {
    const failedCandidate = path.join(
      path.dirname(outputPath),
      `${path.basename(outputPath, path.extname(outputPath))}.failed-presentation.html`,
    );
    fs.renameSync(candidate, failedCandidate);
    emit({
      ok: false,
      stage: 'presentation-browser-audit',
      errors: receipt.errors,
      warnings: receipt.warnings,
      candidate: failedCandidate,
      presentation: receipt,
    }, args.json);
    process.exitCode = 7;
    return;
  }

  atomicWriteFile(outputPath, fs.readFileSync(candidate));
  fs.rmSync(candidate, { force: true });
  const result = {
    ok: true,
    output: outputPath,
    quality: validation.quality,
    sourceHash: rendered.sourceHash,
    artifactSha256: sha256File(outputPath),
    layoutReceipt: rendered.layoutReceipt,
    validation: {
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      checks: validation.checks,
    },
    presentation: receipt,
  };
  emit(result, args.json);
}

main();
