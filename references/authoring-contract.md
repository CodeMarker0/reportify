# Reportify Authoring Contract

Use this reference while creating or editing a Reportify JSON specification.

## 1. Choose one archetype

- `status`: current outcome, workstreams, blockers, risks, and next actions.
- `decision`: options, criteria, recommendation, trade-offs, prerequisites, and next action.
- `research`: question, ranked findings, confidence boundaries, limitations, implications, and next action.

Do not mix all three shapes into one main page. Put adjacent detail into later sections.

## 2. Executive layer

The first screen should answer five jobs:

1. What is true, current, or recommended?
2. What is in scope?
3. What evidence carries the answer?
4. What changes because of it?
5. What happens next?

Use `executive.answer`, `scope`, `implications`, and `next_action`. Keep the answer direct; do not begin with a long history.

## 3. Evidence rules

- Every headline numerical metric should have `evidence_ref`.
- An item should use `evidence_ref` when a reader may reasonably ask where the claim came from.
- Sources must be relocatable: file plus heading or line range, artifact plus section, dataset plus record/query, or stable URL.
- Never invent values, percentages, dates, owners, completion status, confidence, or citations.
- Use words such as `Unknown`, `TBD`, or `Unassigned` when a material fact was not supplied.
- Redact credentials, secrets, tokens, PII, and unrelated sensitive values.

## 4. Content shape

A card item is one idea:

```json
{
  "id": "retrieval-quality",
  "title": "Retrieval quality",
  "summary": "Offline evaluation now covers the main support scenarios.",
  "details": [
    "Remaining gap: long-tail operational questions",
    "Next: add failure-set regression tests"
  ],
  "status": "in-progress",
  "owner": "Knowledge Platform",
  "evidence_ref": "eval-report"
}
```

When an item needs many fields or more than a short paragraph, use a `table`, `text`, or dedicated section instead of making the card taller.

## 5. Section-specific requirements

### `summary`

Use 1–6 items. The compiler selects compact strip, columns, featured stack, or card flow from item weights.

### `status`

Use items with a real `status`. Add `owner` and `date` only when supplied.

### `findings`

Order items by importance. Each finding should state evidence, consequence, and next action in `summary`/`details`.

### `comparison`

Define shared `criteria` and one item per option. Put criterion values in the item's `values` object using criterion IDs as keys. Use `recommended: true` on at most one option.

```json
{
  "kind": "comparison",
  "criteria": [
    { "id": "speed", "label": "Delivery speed" },
    { "id": "risk", "label": "Operational risk" }
  ],
  "items": [
    {
      "id": "option-a",
      "title": "Option A",
      "values": { "speed": "Fast", "risk": "Medium" },
      "recommended": true
    }
  ]
}
```

### `timeline`

Use `date`, `title`, `summary`, and optional `status`. Keep dates in authored form; the renderer does not infer chronology from ambiguous text.

### `table`

Define `columns` and `rows`. Each row key should correspond to a column key. Use tables for homogeneous inventories rather than dozens of cards.

### `flow`

Use ordered `items`; order is the process direction. This initial version intentionally does not infer arbitrary graph topology.

### `actions`

Use `priority`, `owner`, and `date` only when known. Start titles with clear action verbs.

### `text`

Use `content` for short prose and `bullets` for supporting points. Long appendices should be separate artifacts or `<details>` content in a future version, not an enormous main-page paragraph.

## 6. Language

Use the user's chosen language. `meta.locale` controls renderer-owned labels only; authored content is never translated automatically. Preserve exact product names, identifiers, protocols, commands, paths, and environment names.

## 7. Placeholders

The following are showcase failures unless the user explicitly asked for a template:

- `Lorem ipsum`
- `TODO`
- `TBD` used as decorative filler rather than an honest unknown
- `{{PLACEHOLDER}}`
- `Example metric`
- fake company, owner, or source names presented as real
