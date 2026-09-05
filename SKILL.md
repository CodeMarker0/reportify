---
name: reportify
description: Create evidence-aware, standalone HTML reports and paged presentations from typed JSON. Use for status updates, decision briefs, research summaries, and executive reviews. Includes deterministic layout, page navigation, and browser quality gates; not native PowerPoint editing.
license: MIT
metadata:
  version: "0.2.0"
  author: Reportify Contributors
---

# Reportify

Author meaning, not HTML. The compiler owns layout, CSS, pagination, and runtime.
Default quality: `showcase`. Keep facts intact and design restrained.

## Workflow

1. Choose `status`, `decision`, or `research`; read `references/quick-authoring.md`.
2. Write a small report JSON. Omit defaults and empty optional fields. Do not read renderer internals or every example during routine authoring.
3. Validate: `node bin/reportify.mjs validate <spec.json> --quality showcase --json`.
4. Deliver for the intended reading mode:
   - Meetings, briefings, or page navigation: `node bin/reportify-present.mjs <spec.json> <out.html> --quality showcase --json`.
   - Explicit long-form reading/archive: `node bin/reportify.mjs deliver <spec.json> <out.html> --quality showcase --json`.
5. Inspect screenshots for hierarchy, readable type, alignment, balance, and coherent emphasis. Geometry acceptance is not aesthetic approval. Repair only affected JSON fields, rerun delivery, and recheck changed pages.
6. Return the HTML path, mode, page count when paged, check summary, screenshot location, and unresolved limitations. Keep full hashes/diagnostics in the receipt rather than repeating them in chat.

## Non-negotiable

- Never invent facts, metrics, owners, dates, confidence, or sources. Preserve identifiers; redact secrets. Use an explicit unknown when material information is missing.
- Put the conclusion and next action in `executive`; every headline number needs a valid `evidence_ref`. A reference link does not prove a claim is true.
- One idea per item. Use `table` for inventories, `text` for prose, and short, ordered findings/actions. Leave `layout` absent or `auto` unless necessary.
- `emphasis: true` means important, not long. Prefer one emphasis per section. `density` adjusts spacing, not font size; default is `balanced`.
- Do not fabricate filler, make ordinary cards equal-height, clip overflow, or shrink text to force a page to fit. Split dense sections at semantic boundaries.
- A nonzero exit is failure. Never bypass `showcase` to deliver a broken report or describe an unrun check as passed. Keep the previous accepted artifact until replacement passes.

## Load only when needed

- Field/type questions: `schemas/report.schema.json`; one matching example in `examples/`.
- Evidence or content shape: `references/authoring-contract.md`.
- Layout diagnostics: `references/layout-contract.md`.
- Paging/overflow: `references/presentation-contract.md`.
- Delivery environment: `references/delivery-contract.md`; `node bin/reportify.mjs doctor`.

Routine runs should not print the final HTML or reread all source code. Reuse stable IDs and patch local content; browser checks remain mandatory. Runtime, tests, and references carry detailed rules so this entry stays small.
