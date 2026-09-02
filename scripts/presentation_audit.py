#!/usr/bin/env python3
"""Run page-by-page Reportify presentation audits and screenshots with Playwright."""

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
                page = browser.new_page(
                    viewport={"width": width, "height": height},
                    device_scale_factor=1,
                )
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
                    page.wait_for_selector(
                        'html[data-reportify-presentation-ready="true"]',
                        state="attached",
                        timeout=15_000,
                    )
                    page.evaluate("() => window.ReportifyPresentation.setView('paged')")
                    page_count = int(page.evaluate("() => window.ReportifyPresentation.pageCount()"))
                    page_results: list[dict] = []

                    for page_index in range(page_count):
                        page.evaluate(
                            "index => window.ReportifyPresentation.goToPage(index)",
                            page_index,
                        )
                        page.wait_for_timeout(80)
                        audit = page.evaluate("() => window.Reportify.runAudit()")
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
                            browser_errors.clear()

                        screenshot = output_dir / (
                            f"{width}x{height}-{theme}-page-{page_index + 1:02d}-of-{page_count:02d}.png"
                        )
                        page.screenshot(
                            path=str(screenshot),
                            full_page=False,
                            animations="disabled",
                        )
                        page_results.append(
                            {
                                "accepted": bool(audit.get("accepted")),
                                "page": page_index + 1,
                                "pageCount": page_count,
                                "screenshot": str(screenshot),
                                "audit": audit,
                            }
                        )

                    results.append(
                        {
                            "accepted": all(entry["accepted"] for entry in page_results),
                            "viewport": viewport,
                            "pageCount": page_count,
                            "pages": page_results,
                        }
                    )
                except Exception as error:  # noqa: BLE001
                    results.append(
                        {
                            "accepted": False,
                            "viewport": viewport,
                            "pageCount": 0,
                            "pages": [],
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
