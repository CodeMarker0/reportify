#!/usr/bin/env python3
"""Run Reportify browser geometry audits and screenshots with Playwright."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("html", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--chrome", default="")
    parser.add_argument("--matrix", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    html_path = args.html.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    matrix = json.loads(args.matrix)
    html_text = html_path.read_text(encoding="utf-8")
    results: list[dict] = []

    with sync_playwright() as playwright:
        launch_kwargs = {
            "headless": True,
            "args": ["--no-sandbox", "--disable-dev-shm-usage"],
        }
        if args.chrome:
            launch_kwargs["executable_path"] = args.chrome
        browser = playwright.chromium.launch(**launch_kwargs)
        try:
            for viewport in matrix:
                width = int(viewport["width"])
                height = int(viewport["height"])
                theme = str(viewport.get("theme", "light"))
                name = f"{width}x{height}-{theme}"
                screenshot = output_dir / f"{name}.png"
                page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
                browser_errors: list[str] = []
                page.on("pageerror", lambda error: browser_errors.append(str(error)))
                page.on(
                    "console",
                    lambda message: browser_errors.append(message.text)
                    if message.type == "error"
                    else None,
                )
                try:
                    page.set_content(html_text, wait_until="load", timeout=30_000)
                    page.evaluate(
                        "theme => { document.documentElement.dataset.colorMode = theme; }",
                        theme,
                    )
                    page.evaluate("() => window.Reportify.runAudit()")
                    page.wait_for_selector(
                        'html[data-reportify-audit-ready="true"]',
                        state="attached",
                        timeout=15_000,
                    )
                    page.wait_for_timeout(120)
                    raw = page.locator("#reportify-audit-result").text_content()
                    audit = json.loads(raw or "{}")
                    if browser_errors:
                        audit.setdefault("errors", [])
                        for message in browser_errors:
                            audit["errors"].append(
                                {
                                    "level": "error",
                                    "code": "BROWSER_CONSOLE_ERROR",
                                    "subject": "browser",
                                    "message": message,
                                }
                            )
                        audit["errorCount"] = len(audit["errors"])
                        audit["accepted"] = False
                    page.screenshot(path=str(screenshot), full_page=True, animations="disabled")
                    results.append(
                        {
                            "accepted": bool(audit.get("accepted")),
                            "viewport": viewport,
                            "screenshot": str(screenshot),
                            "audit": audit,
                        }
                    )
                except Exception as error:  # noqa: BLE001 - serialized for Node caller
                    try:
                        page.screenshot(path=str(screenshot), full_page=True, animations="disabled")
                        screenshot_value = str(screenshot)
                    except Exception:  # noqa: BLE001
                        screenshot_value = None
                    results.append(
                        {
                            "accepted": False,
                            "viewport": viewport,
                            "screenshot": screenshot_value,
                            "error": str(error),
                        }
                    )
                finally:
                    page.close()
        finally:
            browser.close()

    print(json.dumps({"results": results}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
