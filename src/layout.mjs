function visualLength(value = '') {
  const text = String(value).trim();
  if (!text) return 0;
  let units = 0;
  for (const char of text) {
    if (/\s/.test(char)) units += 0.25;
    else if (/[\u0000-\u007f]/.test(char)) units += 0.55;
    else units += 1;
  }
  return units;
}

function lineEstimate(value, lineCapacity = 30) {
  return Math.max(0, visualLength(value) / lineCapacity);
}

export function estimateItemWeight(item = {}, sectionKind = 'summary') {
  let weight = 0.8;
  weight += Math.max(0.8, lineEstimate(item.title, 24) * 1.2);
  weight += lineEstimate(item.summary, sectionKind === 'findings' ? 38 : 32) * 1.15;

  const details = Array.isArray(item.details) ? item.details : [];
  for (const detail of details) {
    weight += 0.7 + lineEstimate(detail, 34) * 0.95;
  }

  if (item.status) weight += 0.35;
  if (item.priority) weight += 0.25;
  if (item.owner) weight += 0.35 + lineEstimate(item.owner, 34) * 0.25;
  if (item.date) weight += 0.25;
  if (item.evidence_ref) weight += 0.2;
  if (item.recommended) weight += 0.15;

  if (item.values && typeof item.values === 'object') {
    weight += Object.keys(item.values).length * 0.7;
  }

  return Number(weight.toFixed(2));
}

function spread(weights) {
  if (!weights.length) return { min: 0, max: 0, ratio: 1, average: 0 };
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const average = weights.reduce((sum, value) => sum + value, 0) / weights.length;
  return {
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    ratio: Number((max / Math.max(min, 0.01)).toFixed(2)),
    average: Number(average.toFixed(2)),
  };
}

// Semantic importance must never be inferred from how much an author wrote.
// Explicit emphasis wins, then a recommendation, then P0/P1/P2; ties keep order.
export function selectFeaturedIndex(items = []) {
  const rank = (item) => [
    item.emphasis === true ? 1 : 0,
    item.recommended === true ? 1 : 0,
    ({ P0: 3, P1: 2, P2: 1 })[item.priority] || 0,
  ];
  if (!items.length) return null;
  let best = 0;
  for (let index = 1; index < items.length; index += 1) {
    const left = rank(items[index]);
    const right = rank(items[best]);
    const key = left.findIndex((value, part) => value !== right[part]);
    if (key >= 0 && left[key] > right[key]) best = index;
  }
  return best;
}

function automaticCardLayout(kind, weights) {
  const count = weights.length;
  const stats = spread(weights);

  if (kind === 'findings' || kind === 'actions') return 'compact-list';
  if (count === 1) return stats.max <= 5.5 ? 'compact-strip' : 'cards';
  if (count === 2) return stats.ratio <= 1.75 ? 'two-column' : 'featured-stack';
  if (count === 3) {
    if (stats.ratio <= 1.45 && stats.max <= 8.5) return 'three-column';
    return 'featured-stack';
  }
  if (count >= 7) return 'compact-list';
  return 'cards';
}

export function compileSectionLayout(section) {
  const weights = (section.items || []).map((item) => estimateItemWeight(item, section.kind));
  const stats = spread(weights);
  let layout = section.layout && section.layout !== 'auto' ? section.layout : null;
  const reason = layout ? 'author-override' : 'compiler';

  if (!layout) {
    switch (section.kind) {
      case 'summary':
      case 'status':
      case 'findings':
      case 'actions':
        layout = automaticCardLayout(section.kind, weights);
        break;
      case 'comparison':
        layout = 'comparison-table';
        break;
      case 'timeline':
        layout = 'timeline';
        break;
      case 'table':
        layout = 'table';
        break;
      case 'flow':
        layout = 'flow';
        break;
      case 'text':
        layout = 'prose';
        break;
      default:
        layout = 'cards';
    }
  }

  const featuredIndex = layout === 'featured-stack' ? selectFeaturedIndex(section.items) : null;

  return {
    sectionId: section.id,
    kind: section.kind,
    layout,
    reason,
    itemWeights: weights,
    weightStats: stats,
    featuredIndex,
    // A concise lead should sit above dense detail, not leave a tall empty column.
    featuredPlacement: featuredIndex !== null && weights[featuredIndex] < stats.max * 0.65
      ? 'lead-strip'
      : 'columns',
    equalHeight: section.kind === 'comparison' && layout === 'cards',
  };
}

export function compileReportLayout(spec) {
  return {
    compilerVersion: 2,
    density: spec.meta.density,
    sections: spec.sections.map(compileSectionLayout),
  };
}
