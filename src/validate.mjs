import { estimateItemWeight } from './layout.mjs';
import { countNumericSignals, isPlainObject, looksLikePlaceholder } from './utils.mjs';

const ARCHETYPES = new Set(['status', 'decision', 'research']);
const AUDIENCES = new Set(['executive', 'technical', 'mixed']);
const LOCALES = new Set(['zh-CN', 'en']);
const THEMES = new Set(['executive-blue', 'paper', 'midnight']);
const DENSITIES = new Set(['compact', 'balanced', 'spacious']);
const QUALITIES = new Set(['standard', 'showcase']);
const KINDS = new Set([
  'summary',
  'status',
  'findings',
  'comparison',
  'timeline',
  'table',
  'flow',
  'actions',
  'text',
]);
const LAYOUTS = new Set([
  'auto',
  'compact-strip',
  'two-column',
  'three-column',
  'featured-stack',
  'cards',
  'compact-list',
  'comparison-table',
  'timeline',
  'table',
  'flow',
  'prose',
]);
const STATUSES = new Set([
  'done',
  'in-progress',
  'blocked',
  'planned',
  'good',
  'warning',
  'risk',
  'neutral',
]);
const PRIORITIES = new Set(['P0', 'P1', 'P2']);
const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const ROOT_KEYS = new Set(['schema_version', 'meta', 'executive', 'metrics', 'sections', 'sources']);
const META_KEYS = new Set(['title', 'subtitle', 'eyebrow', 'audience', 'archetype', 'locale', 'theme', 'density', 'quality_profile', 'author', 'updated_at']);
const EXECUTIVE_KEYS = new Set(['answer', 'scope', 'implications', 'next_action']);
const METRIC_KEYS = new Set(['id', 'value', 'label', 'status', 'evidence_ref']);
const SOURCE_KEYS = new Set(['id', 'label', 'location', 'note']);
const ITEM_KEYS = new Set(['id', 'title', 'summary', 'details', 'status', 'owner', 'date', 'priority', 'evidence_ref', 'emphasis', 'recommended', 'values']);
const SECTION_KEYS = new Set(['id', 'title', 'note', 'kind', 'layout', 'items', 'criteria', 'columns', 'rows', 'content', 'bullets']);
const CRITERION_KEYS = new Set(['id', 'label', 'description']);
const COLUMN_KEYS = new Set(['key', 'label', 'align']);

const KIND_LAYOUTS = {
  summary: new Set(['auto', 'compact-strip', 'two-column', 'three-column', 'featured-stack', 'cards', 'compact-list']),
  status: new Set(['auto', 'compact-strip', 'two-column', 'three-column', 'featured-stack', 'cards', 'compact-list']),
  findings: new Set(['auto', 'compact-list', 'cards']),
  comparison: new Set(['auto', 'comparison-table', 'cards']),
  timeline: new Set(['auto', 'timeline']),
  table: new Set(['auto', 'table']),
  flow: new Set(['auto', 'flow']),
  actions: new Set(['auto', 'compact-list', 'cards']),
  text: new Set(['auto', 'prose']),
};

function issue(level, code, path, message, evidence = undefined, supportedFixes = undefined) {
  return {
    level,
    code,
    path,
    message,
    ...(evidence ? { evidence } : {}),
    ...(supportedFixes ? { supportedFixes } : {}),
  };
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function rejectUnknownKeys(value, allowed, path, errors) {
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(issue(
        'error',
        'UNKNOWN_FIELD',
        `${path}.${key}`,
        `Unsupported field: ${key}.`,
        { allowed: [...allowed] },
        ['remove-unknown-field', 'move-content-to-supported-field'],
      ));
    }
  }
}

function registerId(id, path, ids, errors) {
  if (!nonEmptyString(id) || !ID_RE.test(id)) {
    errors.push(issue('error', 'INVALID_ID', path, 'ID must match ^[A-Za-z][A-Za-z0-9_-]{0,63}$.'));
    return;
  }
  if (ids.has(id)) {
    errors.push(issue('error', 'DUPLICATE_ID', path, `Duplicate ID: ${id}.`));
    return;
  }
  ids.add(id);
}

function scanPlaceholders(value, path, warnings) {
  if (typeof value === 'string') {
    if (looksLikePlaceholder(value)) {
      warnings.push(issue(
        'warning',
        'PLACEHOLDER_CONTENT',
        path,
        'Placeholder-like content remains in the report.',
        { value: value.slice(0, 160) },
        ['replace-with-real-content', 'remove-unused-block'],
      ));
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanPlaceholders(entry, `${path}[${index}]`, warnings));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      scanPlaceholders(entry, `${path}.${key}`, warnings);
    }
  }
}

function validateItem(item, path, ids, sourceIds, errors, warnings) {
  if (!isPlainObject(item)) {
    errors.push(issue('error', 'INVALID_ITEM', path, 'Item must be an object.'));
    return;
  }
  rejectUnknownKeys(item, ITEM_KEYS, path, errors);
  registerId(item.id, `${path}.id`, ids, errors);
  if (!nonEmptyString(item.title)) {
    errors.push(issue('error', 'MISSING_ITEM_TITLE', `${path}.title`, 'Item title is required.'));
  }
  if (!nonEmptyString(item.summary) && !(Array.isArray(item.details) && item.details.length) && !isPlainObject(item.values)) {
    warnings.push(issue(
      'warning',
      'THIN_ITEM',
      path,
      'Item has a title but no summary, details, or comparison values.',
      undefined,
      ['add-supported-content', 'merge-with-adjacent-item', 'remove-item'],
    ));
  }
  if (item.status !== undefined && !STATUSES.has(item.status)) {
    errors.push(issue('error', 'INVALID_STATUS', `${path}.status`, `Unsupported status: ${item.status}.`));
  }
  if (item.priority !== undefined && !PRIORITIES.has(item.priority)) {
    errors.push(issue('error', 'INVALID_PRIORITY', `${path}.priority`, `Unsupported priority: ${item.priority}.`));
  }
  if (item.evidence_ref !== undefined && !sourceIds.has(item.evidence_ref)) {
    errors.push(issue(
      'error',
      'BROKEN_EVIDENCE_REF',
      `${path}.evidence_ref`,
      `Unknown source ID: ${item.evidence_ref}.`,
      undefined,
      ['add-source', 'fix-evidence-ref', 'remove-unsupported-claim'],
    ));
  }
  if (item.details !== undefined && !Array.isArray(item.details)) {
    errors.push(issue('error', 'INVALID_DETAILS', `${path}.details`, 'details must be an array of strings.'));
  }
}

function validateSection(section, index, ids, sourceIds, errors, warnings) {
  const path = `sections[${index}]`;
  if (!isPlainObject(section)) {
    errors.push(issue('error', 'INVALID_SECTION', path, 'Section must be an object.'));
    return;
  }
  rejectUnknownKeys(section, SECTION_KEYS, path, errors);

  registerId(section.id, `${path}.id`, ids, errors);
  if (!nonEmptyString(section.title)) {
    errors.push(issue('error', 'MISSING_SECTION_TITLE', `${path}.title`, 'Section title is required.'));
  }
  if (!KINDS.has(section.kind)) {
    errors.push(issue('error', 'INVALID_SECTION_KIND', `${path}.kind`, `Unsupported section kind: ${section.kind}.`));
    return;
  }

  const layout = section.layout ?? 'auto';
  if (!LAYOUTS.has(layout)) {
    errors.push(issue('error', 'INVALID_LAYOUT', `${path}.layout`, `Unsupported layout: ${layout}.`));
  } else if (!KIND_LAYOUTS[section.kind].has(layout)) {
    errors.push(issue(
      'error',
      'INCOMPATIBLE_LAYOUT',
      `${path}.layout`,
      `Layout ${layout} is incompatible with section kind ${section.kind}.`,
      { supported: [...KIND_LAYOUTS[section.kind]] },
      ['use-auto-layout', 'choose-supported-layout'],
    ));
  }

  const items = Array.isArray(section.items) ? section.items : [];
  if (['summary', 'status', 'findings', 'comparison', 'timeline', 'flow', 'actions'].includes(section.kind) && items.length === 0) {
    errors.push(issue('error', 'EMPTY_SECTION', path, `${section.kind} section requires at least one item.`));
  }
  items.forEach((item, itemIndex) => validateItem(item, `${path}.items[${itemIndex}]`, ids, sourceIds, errors, warnings));

  if (['two-column', 'three-column'].includes(layout) && items.length > 1) {
    const weights = items.map((item) => estimateItemWeight(item, section.kind));
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const ratio = max / Math.max(min, 0.01);
    const threshold = layout === 'three-column' ? 1.45 : 1.75;
    if (ratio > threshold) {
      warnings.push(issue(
        'warning',
        'FORCED_LAYOUT_IMBALANCE',
        `${path}.layout`,
        `Forced ${layout} layout contains materially imbalanced content.`,
        { weights, ratio: Number(ratio.toFixed(2)), threshold },
        ['use-auto-layout', 'use-featured-stack', 'use-compact-list', 'split-section'],
      ));
    }
  }

  if (section.kind === 'status') {
    items.forEach((item, itemIndex) => {
      if (!item?.status) {
        warnings.push(issue(
          'warning',
          'STATUS_WITHOUT_STATE',
          `${path}.items[${itemIndex}]`,
          'Status item has no explicit status.',
          undefined,
          ['add-known-status', 'move-to-summary-section'],
        ));
      }
    });
  }

  if (section.kind === 'comparison') {
    const criteria = Array.isArray(section.criteria) ? section.criteria : [];
    if (criteria.length === 0) {
      errors.push(issue('error', 'MISSING_COMPARISON_CRITERIA', `${path}.criteria`, 'Comparison requires shared criteria.'));
    }
    const criterionIds = new Set();
    criteria.forEach((criterion, criterionIndex) => {
      const criterionPath = `${path}.criteria[${criterionIndex}]`;
      if (!isPlainObject(criterion)) {
        errors.push(issue('error', 'INVALID_CRITERION', criterionPath, 'Criterion must be an object.'));
        return;
      }
      rejectUnknownKeys(criterion, CRITERION_KEYS, criterionPath, errors);
      if (!nonEmptyString(criterion.id) || !ID_RE.test(criterion.id)) {
        errors.push(issue('error', 'INVALID_CRITERION_ID', `${criterionPath}.id`, 'Invalid criterion ID.'));
      } else if (criterionIds.has(criterion.id)) {
        errors.push(issue('error', 'DUPLICATE_CRITERION_ID', `${criterionPath}.id`, `Duplicate criterion ID: ${criterion.id}.`));
      } else {
        criterionIds.add(criterion.id);
      }
      if (!nonEmptyString(criterion.label)) {
        errors.push(issue('error', 'MISSING_CRITERION_LABEL', `${criterionPath}.label`, 'Criterion label is required.'));
      }
    });

    let recommended = 0;
    items.forEach((item, itemIndex) => {
      if (item?.recommended) recommended += 1;
      if (!isPlainObject(item?.values)) {
        errors.push(issue('error', 'MISSING_COMPARISON_VALUES', `${path}.items[${itemIndex}].values`, 'Each comparison option requires a values object.'));
        return;
      }
      for (const key of Object.keys(item.values)) {
        if (!criterionIds.has(key)) {
          warnings.push(issue(
            'warning',
            'UNKNOWN_COMPARISON_VALUE',
            `${path}.items[${itemIndex}].values.${key}`,
            `Value does not correspond to a declared criterion: ${key}.`,
            undefined,
            ['add-criterion', 'remove-unused-value', 'fix-criterion-id'],
          ));
        }
      }
    });
    if (recommended > 1) {
      errors.push(issue('error', 'MULTIPLE_RECOMMENDATIONS', path, 'At most one comparison option may be recommended.'));
    }
  }

  if (section.kind === 'table') {
    const columns = Array.isArray(section.columns) ? section.columns : [];
    const rows = Array.isArray(section.rows) ? section.rows : [];
    if (columns.length === 0) errors.push(issue('error', 'MISSING_TABLE_COLUMNS', `${path}.columns`, 'Table requires columns.'));
    if (rows.length === 0) errors.push(issue('error', 'EMPTY_SECTION', `${path}.rows`, 'Table requires rows.'));
    const keys = new Set();
    columns.forEach((column, columnIndex) => {
      const columnPath = `${path}.columns[${columnIndex}]`;
      if (!isPlainObject(column) || !nonEmptyString(column.key) || !ID_RE.test(column.key)) {
        errors.push(issue('error', 'INVALID_TABLE_COLUMN', columnPath, 'Column requires a valid key and label.'));
        return;
      }
      rejectUnknownKeys(column, COLUMN_KEYS, columnPath, errors);
      if (keys.has(column.key)) errors.push(issue('error', 'DUPLICATE_TABLE_COLUMN', `${columnPath}.key`, `Duplicate column key: ${column.key}.`));
      keys.add(column.key);
      if (!nonEmptyString(column.label)) errors.push(issue('error', 'MISSING_TABLE_COLUMN_LABEL', `${columnPath}.label`, 'Column label is required.'));
    });
    rows.forEach((row, rowIndex) => {
      if (!isPlainObject(row)) {
        errors.push(issue('error', 'INVALID_TABLE_ROW', `${path}.rows[${rowIndex}]`, 'Table row must be an object.'));
      }
    });
  }

  if (section.kind === 'text') {
    const hasContent = nonEmptyString(section.content);
    const hasBullets = Array.isArray(section.bullets) && section.bullets.some(nonEmptyString);
    if (!hasContent && !hasBullets) errors.push(issue('error', 'EMPTY_SECTION', path, 'Text section requires content or bullets.'));
  }

  if (items.length > 6 && ['summary', 'status'].includes(section.kind) && ['cards', 'three-column', 'two-column'].includes(layout)) {
    warnings.push(issue(
      'warning',
      'CARD_OVERLOAD',
      path,
      `Section has ${items.length} items but forces a card layout.`,
      { itemCount: items.length },
      ['use-auto-layout', 'use-compact-list', 'use-table', 'split-section'],
    ));
  }
}

export function normalizeReportSpec(input, qualityOverride) {
  const spec = structuredClone(input);
  spec.meta = isPlainObject(spec.meta) ? spec.meta : {};
  spec.meta.audience ??= 'executive';
  spec.meta.locale ??= 'zh-CN';
  spec.meta.theme ??= 'executive-blue';
  spec.meta.density ??= 'balanced';
  spec.meta.quality_profile = qualityOverride || spec.meta.quality_profile || 'showcase';
  spec.executive = isPlainObject(spec.executive) ? spec.executive : {};
  spec.metrics = Array.isArray(spec.metrics) ? spec.metrics : [];
  spec.sections = Array.isArray(spec.sections) ? spec.sections : [];
  spec.sources = Array.isArray(spec.sources) ? spec.sources : [];
  return spec;
}

export function validateReportSpec(input, options = {}) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(input)) {
    return {
      valid: false,
      accepted: false,
      quality: options.quality || 'showcase',
      errors: [issue('error', 'INVALID_ROOT', '$', 'Report specification must be a JSON object.')],
      warnings,
      checks: {},
    };
  }

  const spec = normalizeReportSpec(input, options.quality);
  const quality = spec.meta.quality_profile;
  const ids = new Set();
  rejectUnknownKeys(input, ROOT_KEYS, '$', errors);
  rejectUnknownKeys(spec.meta, META_KEYS, 'meta', errors);
  rejectUnknownKeys(spec.executive, EXECUTIVE_KEYS, 'executive', errors);

  if (spec.schema_version !== 1) {
    errors.push(issue('error', 'UNSUPPORTED_SCHEMA_VERSION', 'schema_version', 'schema_version must be 1.'));
  }
  if (!nonEmptyString(spec.meta.title)) {
    errors.push(issue('error', 'MISSING_TITLE', 'meta.title', 'Report title is required.'));
  }
  if (!ARCHETYPES.has(spec.meta.archetype)) {
    errors.push(issue('error', 'INVALID_ARCHETYPE', 'meta.archetype', `Unsupported archetype: ${spec.meta.archetype}.`));
  }
  if (!AUDIENCES.has(spec.meta.audience)) errors.push(issue('error', 'INVALID_AUDIENCE', 'meta.audience', `Unsupported audience: ${spec.meta.audience}.`));
  if (!LOCALES.has(spec.meta.locale)) errors.push(issue('error', 'INVALID_LOCALE', 'meta.locale', `Unsupported locale: ${spec.meta.locale}.`));
  if (!THEMES.has(spec.meta.theme)) errors.push(issue('error', 'INVALID_THEME', 'meta.theme', `Unsupported theme: ${spec.meta.theme}.`));
  if (!DENSITIES.has(spec.meta.density)) errors.push(issue('error', 'INVALID_DENSITY', 'meta.density', `Unsupported density: ${spec.meta.density}.`));
  if (!QUALITIES.has(quality)) errors.push(issue('error', 'INVALID_QUALITY_PROFILE', 'meta.quality_profile', `Unsupported quality profile: ${quality}.`));

  if (!nonEmptyString(spec.executive.answer)) {
    warnings.push(issue(
      'warning',
      'MISSING_EXECUTIVE_ANSWER',
      'executive.answer',
      'Executive answer/outcome is missing.',
      undefined,
      ['add-direct-answer', 'change-archetype-if-not-an-executive-report'],
    ));
  }
  if (!nonEmptyString(spec.executive.next_action)) {
    warnings.push(issue(
      'warning',
      'MISSING_NEXT_ACTION',
      'executive.next_action',
      'Next action is missing.',
      undefined,
      ['add-known-next-action', 'state-unknown-or-unassigned'],
    ));
  }

  const sourceIds = new Set();
  spec.sources.forEach((source, index) => {
    const path = `sources[${index}]`;
    if (!isPlainObject(source)) {
      errors.push(issue('error', 'INVALID_SOURCE', path, 'Source must be an object.'));
      return;
    }
    rejectUnknownKeys(source, SOURCE_KEYS, path, errors);
    if (!nonEmptyString(source.id) || !ID_RE.test(source.id)) {
      errors.push(issue('error', 'INVALID_SOURCE_ID', `${path}.id`, 'Source ID is invalid.'));
    } else if (sourceIds.has(source.id)) {
      errors.push(issue('error', 'DUPLICATE_SOURCE_ID', `${path}.id`, `Duplicate source ID: ${source.id}.`));
    } else {
      sourceIds.add(source.id);
      registerId(source.id, `${path}.id`, ids, errors);
    }
    if (!nonEmptyString(source.label)) errors.push(issue('error', 'MISSING_SOURCE_LABEL', `${path}.label`, 'Source label is required.'));
    if (!nonEmptyString(source.location)) errors.push(issue('error', 'MISSING_SOURCE_LOCATION', `${path}.location`, 'Source location is required.'));
  });

  if (!Array.isArray(spec.sections) || spec.sections.length === 0) {
    errors.push(issue('error', 'NO_SECTIONS', 'sections', 'At least one report section is required.'));
  }

  spec.metrics.forEach((metric, index) => {
    const path = `metrics[${index}]`;
    if (!isPlainObject(metric)) {
      errors.push(issue('error', 'INVALID_METRIC', path, 'Metric must be an object.'));
      return;
    }
    rejectUnknownKeys(metric, METRIC_KEYS, path, errors);
    registerId(metric.id, `${path}.id`, ids, errors);
    if (!nonEmptyString(metric.value)) errors.push(issue('error', 'MISSING_METRIC_VALUE', `${path}.value`, 'Metric value is required.'));
    if (!nonEmptyString(metric.label)) errors.push(issue('error', 'MISSING_METRIC_LABEL', `${path}.label`, 'Metric label is required.'));
    if (metric.status !== undefined && !STATUSES.has(metric.status)) errors.push(issue('error', 'INVALID_STATUS', `${path}.status`, `Unsupported status: ${metric.status}.`));
    if (metric.evidence_ref !== undefined && !sourceIds.has(metric.evidence_ref)) {
      errors.push(issue('error', 'BROKEN_EVIDENCE_REF', `${path}.evidence_ref`, `Unknown source ID: ${metric.evidence_ref}.`));
    }
    if (countNumericSignals(metric.value) > 0 && !metric.evidence_ref) {
      warnings.push(issue(
        'warning',
        'UNSUPPORTED_HEADLINE_NUMBER',
        path,
        'Headline numerical metric has no evidence_ref.',
        { value: metric.value },
        ['add-evidence-ref', 'remove-unsupported-metric', 'replace-with-non-numeric-status'],
      ));
    }
  });

  spec.sections.forEach((section, index) => validateSection(section, index, ids, sourceIds, errors, warnings));
  scanPlaceholders(spec, '$', warnings);

  const checks = {
    schemaVersion: spec.schema_version === 1,
    title: nonEmptyString(spec.meta.title),
    archetype: ARCHETYPES.has(spec.meta.archetype),
    uniqueIds: !errors.some((entry) => entry.code === 'DUPLICATE_ID'),
    evidenceRefs: !errors.some((entry) => entry.code === 'BROKEN_EVIDENCE_REF'),
    sections: spec.sections.length > 0,
    noPlaceholders: !warnings.some((entry) => entry.code === 'PLACEHOLDER_CONTENT'),
    supportedHeadlineNumbers: !warnings.some((entry) => entry.code === 'UNSUPPORTED_HEADLINE_NUMBER'),
  };

  const accepted = errors.length === 0 && (quality === 'standard' || warnings.length === 0);
  return {
    valid: errors.length === 0,
    accepted,
    quality,
    errors,
    warnings,
    checks,
    spec,
  };
}
