---
name: reportify
description: Create polished, evidence-aware, standalone HTML reports and paged report presentations from typed JSON, with deterministic layout selection, safe page compilation, current/total page navigation, adaptive content-height cards, browser geometry checks, page-by-page screenshots, and atomic delivery. Use for executive presentations, project status reports, decision briefs, research summaries, operating reviews, implementation reports, roadmaps, capability inventories, and high-quality HTML reports. Do not use for native PowerPoint editing.
license: MIT
metadata:
  version: "0.2.0"
  author: Reportify Contributors
---

# Reportify

Create a self-contained HTML report or paged HTML presentation from a small typed JSON specification. The agent authors report meaning; the packaged compiler owns layout, pagination, CSS, runtime behavior, and objective browser checks.

## Core contract

Never freely author the final HTML when the Reportify runtime is available.

```text
source material
  → report JSON
  → validate
  → deterministic layout
  → render
  → presentation page compiler when needed
  → browser acceptance
  → inspect screenshots
  → hand off
```

The default quality profile is `showcase`.

## Choose the delivery mode

Use **presentation delivery** when the user intends to present, brief, review, walk through, or page through the report. This is the preferred path for executive updates, project reviews, decision briefs, research presentations, and meeting-ready reports.

```bash
node bin/reportify-present.mjs <candidate.json> <output.html> --quality showcase --json
```

Presentation delivery adds:

- previous / next controls;
- visible `current page / total pages` state;
- Arrow, PageUp/PageDown, Home/End, and Space navigation;
- touch swipe navigation;
- section and evidence links that jump across pages;
- paged / scroll view switching;
- safe splitting of card collections, compact lists, timelines, flows, tables, and source ledgers;
- page-by-page Playwright audits and screenshots;
- presentation-specific quality gates.

Use **standard report delivery** when the user explicitly wants a long scrolling HTML report or archive-style document:

```bash
node bin/reportify.mjs deliver <candidate.json> <output.html> --quality showcase --json
```

Do not substitute scrolling delivery when the user's goal is a presentation.

## Authoring workflow

1. Decide the report archetype: `status`, `decision`, or `research`.
2. Read `schemas/report.schema.json`, `references/authoring-contract.md`, and one matching example in `examples/`.
3. Write the candidate JSON before inspecting renderer implementation. Preserve supplied facts, names, identifiers, dates, and sources. Never invent metrics, owners, status, evidence, deadlines, or confidence.
4. Validate after each meaningful edit:

   ```bash
   node bin/reportify.mjs validate <candidate.json> --quality showcase --json
   ```

5. Choose the correct delivery command from the user's intended reading mode.
6. Inspect the generated page screenshots or contact sheet. Automated geometry checks establish an objective floor, not aesthetic perfection.
7. A non-zero exit is never success. Do not hand off a failed candidate or describe an unrun browser check as passed.

## Layout boundaries

- Use stable, meaningful IDs for sections, items, metrics, criteria, and sources.
- Put the answer, current outcome, implication, and next action in `executive`.
- Use `metrics` only for supplied, useful headline values. A numerical metric without `evidence_ref` is a showcase failure.
- Keep each item scoped to one idea. Move long inventories into a `table`, `text`, or dedicated section instead of inflating a card.
- Omit `layout` or use `"auto"` unless the user explicitly requires a structure.
- Never request equal-height cards merely for visual symmetry. Equal height is reserved for true option comparisons with the same criteria.
- Do not use layout instructions to hide content, shrink body text below the supported minimum, or clip overflow.
- Sources must be relocatable: file plus heading or lines, artifact plus section, or stable URL. Keep sensitive values redacted.

## Presentation page compiler

The presentation runtime treats visible semantic blocks as page atoms instead of slicing the DOM at arbitrary pixel offsets.

Default page chunking is conservative:

| Content | Maximum per generated page |
|---|---:|
| Ordinary cards | 6 |
| Comparison cards | 4 |
| Findings / actions rows | 5 |
| Timeline items | 5 |
| Flow steps | 5 |
| Table body rows | 8 |
| Source entries | 6 |

For card grids, prefer balanced compositions such as `2×2`, `3+2`, and `3×2`. Avoid a final single orphan card such as `4+1`.

If a block still exceeds the desktop presentation safe height, presentation acceptance reports `PAGE_VERTICAL_OVERFLOW`. Repair the source section or choose a more compact semantic layout; do not clip or globally scale the page.

## Section router

| Kind | Use for |
|---|---|
| `summary` | A small set of high-level ideas or capability summaries |
| `status` | Current state, workstreams, blockers, and ownership |
| `findings` | Ranked evidence-backed findings |
| `comparison` | Options evaluated against shared criteria |
| `timeline` | Milestones or chronological events |
| `table` | Homogeneous inventories and dense structured data |
| `flow` | A simple ordered process or operating path |
| `actions` | Prioritized next steps |
| `text` | Short prose, assumptions, methodology, or limitations |

Read `references/layout-contract.md` before overriding `layout` or when repairing a layout diagnostic.

## Quality gate

Reportify checks source integrity and rendered browser geometry. Important base diagnostic codes include:

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

- `PAGE_COUNT_MISMATCH`
- `PAGE_VERTICAL_OVERFLOW`
- `ORPHAN_GRID_ITEM`

For `LOW_VERTICAL_FILL`, follow this repair order:

1. remove inappropriate equal-height behavior;
2. change a short card to a compact strip or row;
3. choose a featured-main plus compact-side layout;
4. merge genuinely related short items;
5. move dense detail into a dedicated section;
6. split the section.

For `PAGE_VERTICAL_OVERFLOW`, reduce semantic content per page or split the section at a safe block boundary. Never repair it with `overflow:hidden`, global scaling, or tiny text.

For `ORPHAN_GRID_ITEM`, use a balanced column count or split the card collection so the final row is visually coherent.

## Presentation browser acceptance

`reportify-present` requires Python Playwright for page-by-page acceptance:

```bash
python -m pip install playwright
python -m playwright install chromium
```

The presentation checker visits every compiled page at supported viewports, runs the Reportify DOM audit for that page, captures a screenshot, aggregates all errors and warnings, and atomically replaces the requested output only if the entire presentation passes.

A failed presentation preserves a failed candidate plus the presentation-check receipt and screenshots for diagnosis.

## Optional commands

```bash
node bin/reportify.mjs doctor
node bin/reportify.mjs guide "status update for an executive audience" --json
node bin/reportify.mjs demo ./demo-output
node bin/reportify.mjs visual-check <output.html> --json
npm run present:example
npm test
```

## Output

Return:

- final HTML path;
- report archetype;
- delivery mode (`presentation` or `scroll report`);
- chosen quality profile;
- validation and browser audit summary;
- page count for presentation delivery;
- specification and artifact SHA-256 values when available;
- screenshot/contact-sheet location when generated;
- unresolved limitations or unknowns.
