# Quick authoring

Use this small contract first. Defaults: Chinese (`zh-CN`), executive audience,
`executive-blue`, `balanced`, `showcase`; all layouts `auto`. Schema version is 1.
Keep the same JSON and CLI interfaces; no custom CSS or new schema fields required.

## Minimum useful shape

```json
{
  "schema_version": 1,
  "meta": {"title": "A specific report title", "archetype": "status"},
  "executive": {"answer": "The supported conclusion.", "next_action": "The known next step, or an explicit unknown."},
  "sections": [{
    "id": "outcome", "title": "What changed", "kind": "summary",
    "items": [{"id": "change", "title": "One clear idea", "summary": "Its evidence, consequence, or limit."}]
  }]
}
```

Replace instructional text with supplied facts; do not copy it into deliverables.
IDs start with a letter; remaining characters are letters, digits, `_` or `-`;
maximum 64 characters, unique across the report where required.

## Fields to use

- `meta`: required `title`, `archetype` (`status|decision|research`). Optional
  `locale` (`zh-CN|en`), `audience` (`executive|technical|mixed`), `theme`
  (`executive-blue|paper|midnight`), `density` (`compact|balanced|spacious`),
  `subtitle`, `eyebrow`, `author`, `updated_at`.
- `executive`: `answer`, optional `scope`, `implications` (strings), `next_action`.
- Items: `id`, `title`, `summary`, optional `details` (strings), `status`,
  `priority` (`P0|P1|P2`), `owner`, `date`, `evidence_ref`, `emphasis`.
  Known statuses: `done|in-progress|blocked|planned|good|warning|risk|neutral`.
- `sources`: objects with `id`, `label`, `location`, optional `note`.
  Locations must identify a stable URL, file plus heading/lines, or artifact section.
- `metrics`: objects with `id`, string `value`, `label`, `evidence_ref`.
  Omit metrics when no useful supplied headline values exist.

## Choose the semantic section

Every section needs `id`, `title`, `kind`; optional `note`.

| Kind | Content |
|---|---|
| `summary`, `status` | Short `items`; status items need a known `status`. |
| `findings`, `actions` | Ordered `items`; most important first. |
| `timeline`, `flow` | Ordered `items`; authored chronology/process order is preserved. |
| `comparison` | `criteria: [{id,label}]`; options in `items`, with `values` keyed by criterion ID; at most one `recommended: true`. |
| `table` | `columns: [{key,label}]`, `rows: [{key:value}]`; optional column `align: left|center|right`. |
| `text` | `content` with blank-line-separated paragraphs and/or `bullets` (strings). |

Layout uses content volume for space, not importance. Featured priority is explicit
emphasis, recommendation, P0/P1/P2, then source order. A short lead above dense
supporting details uses a lead strip rather than an empty tall column.

Pagination balances collection counts (six timeline items become 3+3), but does
not guarantee that arbitrary long blocks fit. Browser overflow is still a failure
in showcase. Split dense sections; never hide or delete required facts to pass.

## Renderer regression checks (maintenance only)

```bash
python -m pip install -r scripts/requirements.txt
python -m playwright install chromium
REPORTIFY_REQUIRE_BROWSER=1 node --test test/quality.test.mjs
```

Set `REPORTIFY_TEST_OUTPUT` to an empty output directory to retain generated HTML,
screenshots and `quality-receipt.json`; otherwise temporary output is removed.
The suite checks DOM geometry, palette contrast, real browser controls, replayed
touch events and print CSS. It loads standalone HTML bytes through Playwright;
it does not replace the CLI delivery check or testing on physical mobile devices.
`REPORTIFY_REQUIRE_BROWSER=1` makes missing browser dependencies fail rather than
skip. On PowerShell set `$env:REPORTIFY_REQUIRE_BROWSER="1"` before the command.
