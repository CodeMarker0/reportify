---
name: reportify
description: Create polished, evidence-aware, standalone HTML executive reports from typed JSON, with deterministic layout selection, adaptive content-height cards, low-vertical-fill detection, overflow and overlap checks, multi-viewport browser screenshots, and atomic delivery. Use for HTML reports, executive updates, project status reports, decision briefs, research summaries, operating reviews, implementation reports, roadmaps, capability inventories, and for improving an existing report specification. Do not use for native PowerPoint editing or for a fixed-slide deck unless the user explicitly wants slide-by-slide presentation behavior.
license: MIT
metadata:
  version: "0.1.0"
  author: Reportify Contributors
---

# Reportify

Create a self-contained HTML report from a small typed JSON specification. The agent authors report meaning; the packaged compiler owns layout, CSS, runtime behavior, and objective browser checks.

## Core contract

Never freely author the final HTML when the Reportify runtime is available.

```text
source material → report JSON → validate → deliver → inspect screenshots → hand off
```

The default quality profile is `showcase`.

## Fast path

1. Decide the report archetype: `status`, `decision`, or `research`.
2. Read `schemas/report.schema.json`, `references/authoring-contract.md`, and one matching example in `examples/`.
3. Write the candidate JSON before inspecting renderer implementation. Preserve supplied facts, names, identifiers, dates, and sources. Never invent metrics, owners, status, evidence, deadlines, or confidence.
4. Validate after each meaningful edit:

   ```bash
   node bin/reportify.mjs validate <candidate.json> --quality showcase --json
   ```

5. Deliver only through the acceptance command:

   ```bash
   node bin/reportify.mjs deliver <candidate.json> <output.html> --quality showcase --json
   ```

6. Inspect the generated contact sheet or screenshots. Automated geometry checks establish an objective floor, not aesthetic perfection. If a screenshot shows a defect, modify only the diagnosed section or item, then deliver again.
7. A non-zero exit is never success. Do not hand off a failed candidate or describe an unrun browser check as passed.

## Authoring boundaries

- Use stable, meaningful IDs for sections, items, metrics, criteria, and sources.
- Put the answer, current outcome, implication, and next action in `executive`.
- Use `metrics` only for supplied, useful headline values. A numerical metric without `evidence_ref` is a showcase failure.
- Keep each item scoped to one idea. Move long inventories into a `table`, `text`, or dedicated section instead of inflating a card.
- Omit `layout` or use `"auto"` unless the user explicitly requires a structure. The compiler chooses among compact strip, two columns, three columns, featured stack, card flow, compact list, table, timeline, and flow.
- Never request equal-height cards merely for visual symmetry. Equal height is reserved for true option comparisons with the same criteria.
- Do not use layout instructions to hide content, shrink body text below the supported minimum, or clip overflow.
- Sources must be relocatable: file plus heading or lines, artifact plus section, or stable URL. Keep sensitive values redacted.

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

Reportify checks source integrity and rendered browser geometry. Important diagnostic codes include:

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

For `LOW_VERTICAL_FILL`, follow this repair order:

1. remove inappropriate equal-height behavior;
2. change a short card to a compact strip or row;
3. choose a featured-main plus compact-side layout;
4. merge genuinely related short items;
5. move dense detail into a dedicated section;
6. split the section.

Never repair it by adding filler copy, decorative blank panels, fixed minimum heights, `overflow:hidden`, global scaling, or tiny text.

For `ROW_CONTENT_IMBALANCE`, preserve comparison semantics when the section is a true comparison; otherwise change the layout rather than padding short cards.

## Delivery semantics

`deliver` validates the specification, renders a private candidate, runs Chromium geometry checks at desktop and narrow viewports in light and dark modes, writes screenshots and a JSON receipt, and atomically replaces the output only after the candidate passes. A failed delivery preserves the previous final HTML.

Read `references/delivery-contract.md` for receipts, browser requirements, quality profiles, and failure handling.

## Optional commands

```bash
node bin/reportify.mjs doctor
node bin/reportify.mjs guide "status update for an executive audience" --json
node bin/reportify.mjs demo ./demo-output
node bin/reportify.mjs visual-check <output.html> --json
```

## Output

Return:

- final HTML path;
- report archetype;
- chosen quality profile;
- validation and browser audit summary;
- specification and artifact SHA-256 values;
- truthful screenshot-review status;
- unresolved limitations or unknowns.
