# Changelog

## 0.2.0 — 2026-09-02

- Added first-class paged HTML presentation delivery through `reportify-present`.
- Added a runtime Page Compiler that splits card collections, compact lists, timelines, flows, tables, and source ledgers at semantic boundaries instead of arbitrary pixel cuts.
- Added Previous / Next controls and visible current-page / total-page state.
- Added keyboard navigation with Arrow keys, PageUp/PageDown, Home/End, and Space.
- Added touch swipe navigation and paged / scroll mode switching.
- Added cross-page section navigation and evidence-link routing.
- Added balanced presentation card-grid rules to avoid common `4+1` orphan layouts.
- Added presentation-specific quality gates: `PAGE_COUNT_MISMATCH`, `PAGE_VERTICAL_OVERFLOW`, and `ORPHAN_GRID_ITEM`.
- Added Playwright page-by-page browser audits and per-page screenshots, with optional presentation contact sheets.
- Added atomic presentation delivery that preserves the previous final artifact when any page fails showcase acceptance.
- Updated the Skill contract and documentation so presentation requests use the presentation delivery path while long-form scroll reports remain supported.

## 0.1.0 — 2026-08-30

- Added typed JSON specification for status, decision, and research reports.
- Added deterministic content-weight layout compiler.
- Added content-height card defaults and scoped comparison-only equal height.
- Added source, evidence-reference, placeholder, and headline-number validation.
- Added self-contained HTML renderer with light, dark, print, and narrow-screen support.
- Added browser DOM geometry checks for overflow, clipping, overlap, low vertical fill, content imbalance, tiny text, empty sections, and runtime errors.
- Added multi-viewport screenshots, optional contact sheet, receipts, and atomic delivery.
- Added three complete examples and browser-backed regression tests.
