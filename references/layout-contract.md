# Reportify Layout Contract

Reportify treats layout as a deterministic compilation problem. The model supplies semantic content; the compiler chooses a safe visual structure.

## Content-height default

Ordinary text blocks must use natural content height:

```css
.card-grid {
  align-items: start;
}

.report-card {
  height: auto;
  min-height: 0;
  align-self: start;
}
```

Do not introduce these defaults for ordinary cards:

```css
align-items: stretch;
grid-auto-rows: 1fr;
height: 100%;
min-height: 300px;
```

Equal height is limited to true comparisons with shared criteria and similar content structure.

## Weight model

The compiler estimates each item's visual weight from:

- title length;
- summary length;
- detail count and length;
- owner/date/priority/status metadata;
- comparison value count.

The weight is used only for layout selection; it does not alter facts or text.

## Automatic layout decisions

For `summary` and card-like `status` sections:

| Shape | Typical layout |
|---|---|
| One short item | `compact-strip` |
| Two balanced items | `two-column` |
| Three balanced, reasonably short items | `three-column` |
| Three items with one much denser item | `featured-stack` |
| Four items | `cards` in a 2×2-friendly responsive grid |
| Five or six items | content-height `cards` |
| More than six items | `compact-list` |

`findings` and `actions` default to `compact-list`. `comparison`, `timeline`, `table`, `flow`, and `text` have dedicated layouts.

## Manual layout override

Use an explicit `layout` only when it is semantically required. The validator rejects incompatible choices. For example, `comparison-table` is valid for a comparison, but `timeline` is not valid for a summary.

An explicit override does not bypass browser checks.

## Low vertical fill

A normal content card is diagnosed with `LOW_VERTICAL_FILL` when all are true:

- rendered card height is greater than 220px;
- continuous bottom gap is greater than 72px;
- bottom gap exceeds 35% of usable internal height;
- the block is not explicitly marked as a sparse visual block.

Repair order:

1. remove inappropriate equal height;
2. use a compact strip or list row;
3. use `featured-stack` for one dense item plus short supporting items;
4. merge genuinely related short items;
5. move dense details to a dedicated section;
6. split the section.

Do not add filler, decorative empty panels, minimum height, or bottom-anchored text.

## Row content imbalance

For equal-height comparison cards, the browser audit compares actual content heights. If the tallest content is more than 1.8× the shortest, the layout receives `ROW_CONTENT_IMBALANCE`.

For a true comparison, shorten redundant wording or move shared explanation outside the option cards. For ordinary content, abandon equal height.

## Overflow and typography

- Page-level horizontal overflow is a failure.
- Text clipped by hidden/clip overflow is a failure.
- Body text below 13px is a showcase failure; compact metadata may use 11–12px.
- A layout must not pass by scaling the entire page or reducing text below the floor.
- Long tokens must wrap inside prose and cards. Tables may scroll only inside their bounded wrapper.

## Overlap

The geometry audit checks top-level boxes within the same section. Small border contact is ignored; meaningful rectangle intersection is a failure. The correct repair is to change the grid or content structure, not to hide overflow.
