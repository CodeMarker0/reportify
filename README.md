# Reportify

[简体中文](README.zh-CN.md)

Reportify is an Agent Skill and zero-dependency Node.js renderer for producing polished, standalone HTML executive reports from a small typed JSON specification.

It is designed to prevent common LLM-generated layout failures:

- oversized cards with only a few lines at the top;
- equal-height cards whose content density is badly imbalanced;
- hidden overflow and clipped text;
- tiny text used to force content into a layout;
- unsupported metrics and invented evidence;
- layouts that look acceptable in source code but fail in a real browser.

## Architecture

```text
Natural language / source evidence
              ↓
        Agent-authored JSON
              ↓
     schema + semantic validation
              ↓
 deterministic layout compiler
              ↓
  self-contained HTML/CSS/JavaScript
              ↓
 browser DOM geometry audit + screenshots
              ↓
       atomic final delivery
```

The model decides **what the report says**. Reportify decides **how the report is laid out**.

## Requirements

- Node.js 20+
- Chromium, Google Chrome, or Microsoft Edge for `visual-check` and `deliver`
- Python 3 with Playwright is the recommended browser automation path

No npm dependencies are required. Install the optional browser driver with:

```bash
python -m pip install playwright
```

When a compatible system browser is available, Reportify launches it directly through Playwright. Otherwise install Playwright's Chromium build with `python -m playwright install chromium`.

## Quick start

```bash
node bin/reportify.mjs doctor
node bin/reportify.mjs validate examples/executive-status.report.json --quality showcase
node bin/reportify.mjs deliver examples/executive-status.report.json output/report.html --quality showcase
```

Generate all three demos:

```bash
node bin/reportify.mjs demo ./demo-output
```

## CLI

```text
reportify doctor
reportify guide <scenario> [--json]
reportify validate <report.json> [--quality standard|showcase] [--json]
reportify render <report.json> <report.html> [--quality standard|showcase] [--json]
reportify visual-check <report.html> [--json] [--output-dir <dir>]
reportify deliver <report.json> <report.html> [--quality standard|showcase] [--json]
reportify demo <output-directory>
```

`render` performs deterministic source validation and HTML generation. `deliver` additionally runs the real-browser geometry gate and only replaces the final output after the candidate passes.

## Install as an Agent Skill

Reportify follows the Agent Skills `SKILL.md` format. OpenAI Skills use this open format, so the same repository can be installed into Codex and other compatible agents.

### Codex

```bash
npx -y skills add CodeMarker0/Reportify --skill reportify --agent codex --global --copy --yes
```

Manual installation is also possible by copying this repository into your Codex skills directory so that `SKILL.md` remains at the skill root.

### Claude Code

```bash
npx -y skills add CodeMarker0/Reportify --skill reportify --agent claude-code --global --copy --yes
```

For a project-local Claude Code install, copy the repository to `.claude/skills/reportify/` in your project. For a personal install, use the corresponding Claude Code user skills directory.

### Generic / auto-detect

```bash
npx -y skills add CodeMarker0/Reportify
```

The runtime itself is agent-independent: both Codex and Claude Code invoke the same Node.js CLI and browser quality gates described below.

## Supported report section kinds

- `summary`
- `status`
- `findings`
- `comparison`
- `timeline`
- `table`
- `flow`
- `actions`
- `text`

## Quality profiles

`standard` blocks structural and rendering failures.

`showcase` also treats layout-quality warnings as delivery failures, including low vertical fill, content imbalance in equal-height comparisons, unsupported headline numbers, and too-small text.

## Important design rule

Ordinary text cards are content-height by default. Equal height is opt-in and limited to true comparisons with similar content structure. Reportify never uses `overflow: hidden`, tiny text, or global scaling as a way to counterfeit a pass.
