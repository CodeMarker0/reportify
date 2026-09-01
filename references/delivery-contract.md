# Reportify Delivery Contract

## Commands

Validate source only:

```bash
node bin/reportify.mjs validate report.json --quality showcase --json
```

Render without browser acceptance:

```bash
node bin/reportify.mjs render report.json report.html --quality showcase --json
```

Run browser checks on an existing HTML artifact:

```bash
node bin/reportify.mjs visual-check report.html --json
```

Full accepted delivery:

```bash
node bin/reportify.mjs deliver report.json report.html --quality showcase --json
```

## Atomic behavior

`deliver` writes to a private temporary candidate beside the target. It validates and browser-checks that candidate. Only after acceptance does it rename the candidate over the final output.

If acceptance fails, an existing final output is preserved.

## Browser matrix

The default visual gate checks:

- 1440×900, light;
- 1600×1000, light;
- 1920×1080, dark;
- 2048×1320, light;
- 390×844, light.

The page must not have page-level horizontal overflow at any checked viewport. Narrow layouts may stack vertically.

## Objective and subjective review

Automated checks cover:

- page overflow;
- clipped text;
- top-level box overlap;
- low vertical fill;
- equal-height content imbalance;
- tiny text;
- empty sections;
- runtime JavaScript errors.

Screenshots remain evidence for human or agent inspection. A zero-error geometry receipt does not prove that every aesthetic choice is ideal. The receipt therefore reports `visualReview: "pending"` until someone actually inspects the contact sheet or individual screenshots.

## Quality profiles

`standard` fails on objective errors. Warnings are reported.

`showcase` promotes quality warnings to delivery failures, including low vertical fill, tiny text, content imbalance, unsupported headline numbers, and placeholder content.

## Receipts

A successful delivery receipt includes:

- specification SHA-256 and byte count;
- artifact SHA-256 and byte count;
- selected layouts and estimated weights;
- source validation checks;
- browser viewport results;
- screenshots directory and contact sheet when available;
- truthful visual-review status.

Do not claim a browser pass if Chromium was unavailable. `deliver` fails without a supported browser unless the caller explicitly uses `render` instead of accepted delivery.
