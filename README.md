# Reportify

Reportify is an Agent Skill and zero-runtime-npm-dependency Node.js toolkit for generating polished, evidence-aware, self-contained HTML reports **and meeting-ready paged presentations**.

Its goal is not merely to produce a long HTML page. Reportify separates report meaning from layout and presentation mechanics so an agent can generate a consistent report, compile it into safe visual structures, page it at semantic boundaries, and validate every page in a real browser before delivery.

## Architecture

```text
Natural language / source documents / project facts
                    ↓
             Agent-authored Typed JSON
                    ↓
         Schema + semantic validation
                    ↓
       Deterministic layout compiler
                    ↓
               HTML renderer
                    ↓
         Presentation page compiler
                    ↓
     Paged presentation / scroll report
                    ↓
 Playwright page-by-page DOM audit + screenshots
                    ↓
              Atomic delivery
```

The model decides **what the report says**. Reportify decides **how it is laid out, paged, and accepted**.

## Presentation delivery

Use this for executive briefings, project reviews, decision presentations, research presentations, and other reports intended to be presented page by page:

```bash
node bin/reportify-present.mjs \
  examples/executive-status.report.json \
  output/report.html \
  --quality showcase
```

Presentation output includes:

- Previous / Next controls;
- visible `current page / total pages` state;
- Arrow, PageUp/PageDown, Home/End, and Space navigation;
- touch swipe navigation;
- section navigation and cross-page evidence links;
- paged / scroll view switching;
- print-friendly expansion of all pages;
- deterministic splitting of card groups, compact lists, timelines, flows, tables, and source ledgers;
- page-by-page Playwright audits and screenshots.

The page compiler does not slice content at arbitrary pixel offsets. It keeps semantic blocks intact and uses conservative chunk limits so cards, rows, timeline items, flow steps, and table rows are not cut in half.

Balanced card compositions are preferred: four cards become `2×2`, five become `3+2`, and six become `3×2`, avoiding obvious `4+1` orphan layouts.

## Scroll report delivery

For archive-style or long-form scrolling reports, the original delivery path remains available:

```bash
node bin/reportify.mjs deliver \
  examples/executive-status.report.json \
  output/report.html \
  --quality showcase
```

Presentation output can also switch to scroll mode from the UI or by using `?view=scroll`.

## Browser quality gates

Base Reportify checks include:

- `PAGE_HORIZONTAL_OVERFLOW`
- `TEXT_CLIPPED`
- `ELEMENT_OVERLAP`
- `LOW_VERTICAL_FILL`
- `ROW_CONTENT_IMBALANCE`
- `TINY_TEXT`
- `EMPTY_SECTION`
- `BROKEN_EVIDENCE_REF`
- `UNSUPPORTED_HEADLINE_NUMBER`
- `PLACEHOLDER_CONTENT`

Presentation mode additionally checks:

- `PAGE_COUNT_MISMATCH` — visible page state differs from compiled page state;
- `PAGE_VERTICAL_OVERFLOW` — a desktop presentation page exceeds its safe viewport height;
- `ORPHAN_GRID_ITEM` — the last card-grid row contains a single visually isolated item.

In `showcase` mode, any layout warning blocks final presentation delivery. A failed candidate and its page-by-page audit artifacts are preserved; the previous final output is not overwritten.

## Environment

- Node.js 20+
- Python 3 + Playwright for page-by-page presentation acceptance
- Chromium, Chrome, or Edge

```bash
python -m pip install playwright
python -m playwright install chromium
```

## Quick start

Validate JSON:

```bash
node bin/reportify.mjs validate examples/executive-status.report.json --quality showcase
```

Generate the scrolling example:

```bash
npm run deliver:example
```

Generate the paged presentation example:

```bash
npm run present:example
```

Run tests:

```bash
npm test
```

## Supported report structures

Top-level archetypes:

- `status`
- `decision`
- `research`

Section kinds:

- `summary`
- `status`
- `findings`
- `comparison`
- `timeline`
- `table`
- `flow`
- `actions`
- `text`

## Design principles

Reportify does not create visual symmetry by stretching ordinary cards, adding filler copy, shrinking body text, or hiding overflow. Ordinary content uses natural height; layout is selected from semantic structure and estimated content weight; page breaks happen at safe content boundaries; and browser acceptance is required before the final artifact is replaced.

## Agent Skill installation

### Codex

```bash
npx -y skills add CodeMarker0/Reportify --skill reportify --agent codex --global --copy --yes
```

### Claude Code

```bash
npx -y skills add CodeMarker0/Reportify --skill reportify --agent claude-code --global --copy --yes
```

See `SKILL.md`, `references/authoring-contract.md`, `references/layout-contract.md`, `references/delivery-contract.md`, and `schemas/report.schema.json` for the complete contract.
