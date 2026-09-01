#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport, checkRenderedHtml } from '../src/render.mjs';
import { validateReportSpec } from '../src/validate.mjs';
import { getBrowserCapabilities, visualCheck } from '../src/visual-check.mjs';
import {
  atomicWriteFile,
  ensureDir,
  findChromium,
  findExecutable,
  formatBytes,
  readJsonFile,
  sha256File,
  sha256Text,
  slugify,
} from '../src/utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      flags[rawKey] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[rawKey] = next;
      i += 1;
    } else {
      flags[rawKey] = true;
    }
  }
  return { positional, flags };
}

function emit(value, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  if (typeof value === 'string') process.stdout.write(`${value}\n`);
  else process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return `Reportify 0.1.0

Usage:
  reportify doctor [--json]
  reportify guide <scenario> [--json]
  reportify validate <report.json> [--quality standard|showcase] [--json]
  reportify render <report.json> <report.html> [--quality standard|showcase] [--json]
  reportify visual-check <report.html> [--output-dir <dir>] [--chrome <path>] [--json]
  reportify deliver <report.json> <report.html> [--quality standard|showcase] [--output-dir <dir>] [--chrome <path>] [--json]
  reportify demo <output-directory> [--json]
`;
}

function summarizeValidation(result) {
  return {
    valid: result.valid,
    accepted: result.accepted,
    quality: result.quality,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
    errors: result.errors,
    warnings: result.warnings,
    checks: result.checks,
  };
}

function requireAcceptedValidation(inputPath, quality) {
  const { value } = readJsonFile(inputPath);
  const validation = validateReportSpec(value, { quality });
  return { validation, spec: validation.spec };
}

function renderCandidate(spec) {
  const rendered = renderReport(spec);
  const sourceCheck = checkRenderedHtml(rendered.html);
  return { ...rendered, sourceCheck };
}

function guideScenario(scenario) {
  const text = String(scenario || '').toLowerCase();
  let archetype = 'status';
  let confidence = 0.6;
  if (/(决策|选型|方案|比较|对比|trade-?off|decision|choose|option|vendor)/i.test(text)) {
    archetype = 'decision';
    confidence = 0.9;
  } else if (/(调研|研究|分析|评估|research|assessment|investigation|study)/i.test(text)) {
    archetype = 'research';
    confidence = 0.86;
  } else if (/(状态|进展|汇报|复盘|里程碑|status|progress|update|review)/i.test(text)) {
    archetype = 'status';
    confidence = 0.88;
  }

  const sections = archetype === 'decision'
    ? ['summary', 'comparison', 'findings', 'actions']
    : archetype === 'research'
      ? ['summary', 'findings', 'table', 'actions', 'text']
      : ['summary', 'status', 'timeline', 'actions'];
  return {
    scenario,
    archetype,
    confidence,
    recommendedSections: sections,
    qualityProfile: 'showcase',
    next: `Start from examples/${archetype === 'status' ? 'executive-status' : archetype === 'decision' ? 'decision-brief' : 'research-summary'}.report.json`,
  };
}

function commandDoctor(asJson) {
  const browser = getBrowserCapabilities();
  const montage = findExecutable(['montage', 'magick']);
  const result = {
    ok: browser.acceptedBrowserPathAvailable && Number(process.versions.node.split('.')[0]) >= 20,
    node: process.version,
    nodeSupported: Number(process.versions.node.split('.')[0]) >= 20,
    ...browser,
    contactSheetTool: montage,
    contactSheetAvailable: Boolean(montage),
    skillRoot,
  };
  emit(result, asJson);
  return result.ok ? 0 : 1;
}

function commandValidate(inputPath, flags) {
  const quality = flags.quality || 'showcase';
  const { validation } = requireAcceptedValidation(inputPath, quality);
  const result = summarizeValidation(validation);
  emit(result, Boolean(flags.json));
  return validation.accepted ? 0 : 1;
}

function commandRender(inputPath, outputPath, flags) {
  const quality = flags.quality || 'showcase';
  const { validation, spec } = requireAcceptedValidation(inputPath, quality);
  if (!validation.accepted) {
    emit({ command: 'render', ...summarizeValidation(validation) }, Boolean(flags.json));
    return 1;
  }

  const rendered = renderCandidate(spec);
  const sourceAccepted = rendered.sourceCheck.valid && (quality === 'standard' || rendered.sourceCheck.warnings.length === 0);
  if (!sourceAccepted) {
    emit({
      command: 'render',
      accepted: false,
      validation: summarizeValidation(validation),
      sourceCheck: rendered.sourceCheck,
    }, Boolean(flags.json));
    return 1;
  }

  atomicWriteFile(path.resolve(outputPath), rendered.html);
  const stat = fs.statSync(path.resolve(outputPath));
  const result = {
    command: 'render',
    accepted: true,
    output: path.resolve(outputPath),
    quality,
    specSha256: rendered.sourceHash,
    artifactSha256: sha256File(path.resolve(outputPath)),
    artifactBytes: stat.size,
    layout: rendered.layoutReceipt,
    validation: summarizeValidation(validation),
    sourceCheck: rendered.sourceCheck,
    browserCheck: 'not-run',
  };
  emit(result, Boolean(flags.json));
  return 0;
}

function commandVisualCheck(htmlPath, flags) {
  const receipt = visualCheck(htmlPath, {
    outputDir: flags['output-dir'],
    chrome: flags.chrome,
  });
  emit(receipt, Boolean(flags.json));
  return receipt.accepted ? 0 : 1;
}

function commandDeliver(inputPath, outputPath, flags) {
  const quality = flags.quality || 'showcase';
  const { validation, spec } = requireAcceptedValidation(inputPath, quality);
  const finalPath = path.resolve(outputPath);
  const checkDir = path.resolve(
    flags['output-dir'] || path.join(
      path.dirname(finalPath),
      `${slugify(path.basename(finalPath, path.extname(finalPath)))}.reportify-checks`,
    ),
  );
  ensureDir(checkDir);

  const receiptPath = path.join(checkDir, 'delivery-receipt.json');
  const sourceSnapshot = JSON.stringify(spec);
  atomicWriteFile(path.join(checkDir, 'source.snapshot.json'), sourceSnapshot);

  if (!validation.accepted) {
    const receipt = {
      command: 'deliver',
      accepted: false,
      stage: 'source-validation',
      finalOutput: finalPath,
      quality,
      validation: summarizeValidation(validation),
    };
    atomicWriteFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    emit(receipt, Boolean(flags.json));
    return 1;
  }

  const rendered = renderCandidate(spec);
  const sourceAccepted = rendered.sourceCheck.valid && (quality === 'standard' || rendered.sourceCheck.warnings.length === 0);
  if (!sourceAccepted) {
    const receipt = {
      command: 'deliver',
      accepted: false,
      stage: 'render-contract',
      finalOutput: finalPath,
      quality,
      validation: summarizeValidation(validation),
      sourceCheck: rendered.sourceCheck,
    };
    atomicWriteFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    emit(receipt, Boolean(flags.json));
    return 1;
  }

  const candidatePath = path.join(checkDir, `.${path.basename(finalPath)}.candidate.html`);
  atomicWriteFile(candidatePath, rendered.html);
  const browser = visualCheck(candidatePath, {
    outputDir: checkDir,
    chrome: flags.chrome,
  });

  if (!browser.accepted) {
    const receipt = {
      command: 'deliver',
      accepted: false,
      stage: 'browser-acceptance',
      quality,
      finalOutput: finalPath,
      preservedPreviousOutput: fs.existsSync(finalPath),
      failedCandidate: candidatePath,
      specSha256: sha256Text(sourceSnapshot),
      validation: summarizeValidation(validation),
      sourceCheck: rendered.sourceCheck,
      layout: rendered.layoutReceipt,
      browser,
    };
    atomicWriteFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    emit(receipt, Boolean(flags.json));
    return 1;
  }

  atomicWriteFile(finalPath, rendered.html);
  fs.rmSync(candidatePath, { force: true });
  const artifactStat = fs.statSync(finalPath);
  const receipt = {
    command: 'deliver',
    accepted: true,
    stage: 'complete',
    quality,
    archetype: spec.meta.archetype,
    finalOutput: finalPath,
    specSnapshot: path.join(checkDir, 'source.snapshot.json'),
    specSha256: sha256Text(sourceSnapshot),
    specBytes: Buffer.byteLength(sourceSnapshot),
    artifactSha256: sha256File(finalPath),
    artifactBytes: artifactStat.size,
    artifactSize: formatBytes(artifactStat.size),
    validation: summarizeValidation(validation),
    sourceCheck: rendered.sourceCheck,
    layout: rendered.layoutReceipt,
    browser: {
      accepted: browser.accepted,
      browser: browser.browser,
      visualReview: browser.visualReview,
      errorCount: browser.errorCount,
      warningCount: browser.warningCount,
      outputDir: browser.outputDir,
      contactSheet: browser.contactSheet,
      results: browser.results,
    },
    visualReview: browser.visualReview,
    receiptPath,
  };
  atomicWriteFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  emit(receipt, Boolean(flags.json));
  return 0;
}

function commandDemo(outputDirectory, flags) {
  const out = path.resolve(outputDirectory || './demo-output');
  ensureDir(out);
  const examples = [
    'executive-status.report.json',
    'decision-brief.report.json',
    'research-summary.report.json',
  ];
  const outputs = [];
  for (const example of examples) {
    const input = path.join(skillRoot, 'examples', example);
    const output = path.join(out, example.replace('.report.json', '.html'));
    const { value } = readJsonFile(input);
    const validation = validateReportSpec(value, { quality: 'showcase' });
    if (!validation.accepted) {
      outputs.push({ input, output, accepted: false, validation: summarizeValidation(validation) });
      continue;
    }
    const rendered = renderCandidate(validation.spec);
    atomicWriteFile(output, rendered.html);
    outputs.push({
      input,
      output,
      accepted: rendered.sourceCheck.valid,
      artifactSha256: sha256File(output),
      layout: rendered.layoutReceipt,
    });
  }
  const accepted = outputs.every((entry) => entry.accepted);
  const receipt = { command: 'demo', accepted, outputDirectory: out, outputs, browserCheck: 'not-run' };
  emit(receipt, Boolean(flags.json));
  return accepted ? 0 : 1;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  const asJson = Boolean(flags.json);

  if (!command || command === 'help' || flags.help) {
    emit(usage(), false);
    return 0;
  }

  switch (command) {
    case 'doctor':
      return commandDoctor(asJson);
    case 'guide':
      if (!positional.length) throw new Error('guide requires a scenario.');
      emit(guideScenario(positional.join(' ')), asJson);
      return 0;
    case 'validate':
      if (!positional[0]) throw new Error('validate requires <report.json>.');
      return commandValidate(positional[0], flags);
    case 'render':
      if (!positional[0] || !positional[1]) throw new Error('render requires <report.json> <report.html>.');
      return commandRender(positional[0], positional[1], flags);
    case 'visual-check':
      if (!positional[0]) throw new Error('visual-check requires <report.html>.');
      return commandVisualCheck(positional[0], flags);
    case 'deliver':
      if (!positional[0] || !positional[1]) throw new Error('deliver requires <report.json> <report.html>.');
      return commandDeliver(positional[0], positional[1], flags);
    case 'demo':
      return commandDemo(positional[0], flags);
    default:
      throw new Error(`Unknown command: ${command}.\n\n${usage()}`);
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`reportify: ${error.message}\n`);
    process.exitCode = 1;
  });
