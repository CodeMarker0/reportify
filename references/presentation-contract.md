# Reportify Presentation Contract

Presentation delivery turns a validated Reportify HTML report into a meeting-ready paged experience. It is not a native slide format and it must not emulate slides by clipping arbitrary DOM regions.

## Delivery command

Use presentation delivery when the report is intended to be briefed or walked through page by page:

```bash
node bin/reportify-present.mjs <report.json> <output.html> --quality showcase --json
```

Long-form archive or reading mode can continue to use `reportify.mjs deliver`.

## Page model

The page compiler runs after the deterministic report renderer. It treats semantic blocks as page atoms and creates presentation pages without changing report facts.

The cover/hero becomes the first page. Each report section becomes one or more pages. Long supported collections are split only between complete items.

Safe split units include:

- report cards;
- comparison cards;
- compact finding/action rows;
- timeline items;
- flow steps;
- table body rows;
- source ledger entries.

A card, list row, timeline node, flow step, or table row must never be cut in half merely to fill a viewport.

## Default page chunk limits

| Content type | Maximum per page |
|---|---:|
| Ordinary cards | 6 |
| Comparison cards | 4 |
| Compact finding/action rows | 5 |
| Timeline items | 5 |
| Flow steps | 5 |
| Table body rows | 8 |
| Source entries | 6 |

These are conservative composition limits, not factual limits. A browser audit can still reject a page if the content inside those atoms is unusually dense.

## Balanced card composition

Avoid obvious orphan-card layouts in presentation mode.

Preferred desktop compositions include:

- 4 cards → `2 × 2`;
- 5 cards → `3 + 2`;
- 6 cards → `3 × 2`.

A final row containing one isolated card after a multi-column row is diagnosed as `ORPHAN_GRID_ITEM`.

Do not repair an orphan by adding filler content or decorative empty cards.

## Navigation contract

Paged output must provide:

- Previous and Next buttons;
- visible current page number;
- visible total page count;
- Arrow Left/Right navigation;
- PageUp/PageDown navigation;
- Home/End navigation;
- Space to advance;
- touch swipe navigation on supported devices;
- section navigation that jumps to the correct page;
- evidence links that can jump to source entries on another page.

The visible page indicator must reflect the actual compiled page state. A mismatch is a hard `PAGE_COUNT_MISMATCH` error.

## Paged and scroll views

Presentation HTML defaults to paged mode. The same artifact may switch to scroll mode for reading or use `?view=scroll`.

Changing views must not alter report facts, source relationships, or the order of semantic content.

## Desktop safe height

On desktop presentation viewports, a page should fit within the safe viewport area below the report toolbar and above the page controls.

If the current page requires vertical scrolling beyond the supported tolerance, the presentation browser audit emits `PAGE_VERTICAL_OVERFLOW`.

Repair order:

1. reduce items per semantic section;
2. split the section into clearer subtopics;
3. use an existing compact layout when semantically appropriate;
4. shorten redundant wording without deleting required facts.

Never repair vertical overflow with:

- `overflow: hidden`;
- global page scaling;
- tiny body text;
- fixed-height clipping;
- deletion of evidence or material facts.

Mobile viewports are allowed to grow vertically because the primary mobile interaction is swipe/page navigation plus normal vertical reading within the current page.

## Page-by-page acceptance

Presentation acceptance requires Python Playwright. The checker must visit every compiled page for every configured viewport/theme combination, run the Reportify DOM audit on that page, and capture a page screenshot.

The default presentation matrix includes:

- 1440 × 900, light;
- 1920 × 1080, dark;
- 390 × 844, light.

Base Reportify geometry diagnostics remain active on every page, including clipping, overlap, horizontal overflow, tiny text, low vertical fill, and runtime errors.

Presentation-specific diagnostics are:

- `PAGE_COUNT_MISMATCH`;
- `PAGE_VERTICAL_OVERFLOW`;
- `ORPHAN_GRID_ITEM`.

In `showcase` mode, any warning or error blocks final delivery.

## Atomic delivery

The presentation command writes a private candidate first. Only a fully accepted candidate replaces the requested output path.

When acceptance fails:

- the previous final artifact remains unchanged;
- a failed presentation candidate is preserved;
- page screenshots are preserved;
- `presentation-check.json` is preserved;
- the failure must not be described as a successful delivery.

## Aesthetic review

Automated checks establish an objective quality floor. They do not prove aesthetic perfection.

After browser acceptance, inspect the generated page screenshots or contact sheet for:

- visual rhythm across pages;
- consistent hierarchy and spacing;
- balanced page density;
- repeated-layout fatigue;
- awkward line wrapping;
- overly dense prose;
- any composition that is technically valid but visually uncomfortable.

If a screenshot looks wrong, modify the smallest responsible section or item and rerun presentation delivery.
