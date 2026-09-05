#!/usr/bin/env python3
"""Browser regressions for the deterministic renderer; no model or network required."""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def contrast(first, second):
    def luminance(value):
        rgb = [int(value.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb]
        return sum(a * b for a, b in zip(linear, (0.2126, 0.7152, 0.0722)))
    a, b = sorted((luminance(first), luminance(second)))
    return (b + 0.05) / (a + 0.05)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=Path)
    parser.add_argument('--chrome')
    args = parser.parse_args()
    directory = args.directory.resolve()
    receipt = {'accepted': False, 'assertions': 0, 'pageAudits': 0, 'screenshots': [], 'density': {}, 'contrast': {}}

    def check(value, message):
        receipt['assertions'] += 1
        if not value:
            raise AssertionError(message)

    with sync_playwright() as pw:
        options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        if args.chrome:
            options['executable_path'] = args.chrome
        browser = pw.chromium.launch(**options)
        context = browser.new_context(has_touch=True, reduced_motion='reduce')
        page = context.new_page()
        runtime_errors = []
        page.on('pageerror', lambda error: runtime_errors.append(str(error)))

        def load(name, width=1440, height=900, fragment=''):
            nonlocal page
            page.close()
            page = context.new_page()
            page.on('pageerror', lambda error: runtime_errors.append(str(error)))
            page.set_viewport_size({'width': width, 'height': height})
            # Load exact standalone bytes without requiring file:// or an HTTP server.
            if fragment:
                page.evaluate('(hash) => history.replaceState(null, "", hash)', fragment)
            page.set_content((directory / name).read_text(encoding='utf-8'), wait_until='load')
            page.wait_for_function('() => window.Reportify && document.documentElement.dataset.reportifyAuditReady === "true"')
            if '.paged.' in name:
                page.wait_for_function('() => document.documentElement.dataset.reportifyPresentationReady === "true"')
            page.evaluate('document.fonts.ready')

        def current():
            return page.evaluate('ReportifyPresentation.currentPage()')

        def screenshot(name):
            dest = directory / name
            page.screenshot(path=str(dest), full_page=False)
            receipt['screenshots'].append(str(dest))

        for theme in ('executive-blue', 'paper', 'midnight'):
            for density in ('compact', 'balanced', 'spacious'):
                for width, height in ((1440, 900), (390, 844)):
                    for paged in (False, True):
                        name = f'{theme}-{density}{".paged" if paged else ""}.html'
                        load(name, width, height)
                        check(page.get_attribute('html', 'data-density') == density, f'{name}: density not rendered')
                        check(page.evaluate('parseFloat(getComputedStyle(document.body).fontSize)') >= 14, 'Body text shrank below 14px')
                        if not paged:
                            pad = page.locator('.report-card').first.evaluate('(el) => parseFloat(getComputedStyle(el).paddingTop)')
                            receipt['density'][f'{theme}-{width}-{density}'] = pad
                            palette = page.evaluate('''() => {
                              const s = getComputedStyle(document.documentElement);
                              return Object.fromEntries(['--muted', '--page', '--surface', '--surface-2', '--surface-3', '--accent-soft'].map(k => [k, s.getPropertyValue(k).trim()]));
                            }''')
                            ratios = {key: round(contrast(palette['--muted'], value), 3) for key, value in palette.items() if key != '--muted'}
                            receipt['contrast'][theme] = ratios
                            check(min(ratios.values()) >= 4.5, f'{theme}: muted text contrast {ratios}')
                        count = page.evaluate('ReportifyPresentation.pageCount()') if paged else 1
                        for index in range(count):
                            if paged:
                                page.evaluate('(i) => ReportifyPresentation.goToPage(i)', index)
                            audit = page.evaluate('Reportify.runAudit()')
                            receipt['pageAudits'] += 1
                            check(audit['accepted'], f'{name} {width} page {index + 1}: {audit["errors"] + audit["warnings"]}')
                            if paged:
                                box = page.locator('.presentation-controls').bounding_box()
                                check(box is not None and abs(box['x'] + box['width'] / 2 - width / 2) < 1, 'Pagination controls are not centered')
                                check(box['x'] >= 0 and box['x'] + box['width'] <= width + 1, 'Pagination controls leave the viewport')
                        if density == 'balanced' and paged:
                            page.evaluate('ReportifyPresentation.goToPage(0)')
                            screenshot(f'{theme}-{width}-cover.png')
                            page.evaluate('ReportifyPresentation.goToPage(1)')
                            screenshot(f'{theme}-{width}-hierarchy.png')
            for width in (1440, 390):
                values = [receipt['density'][f'{theme}-{width}-{density}'] for density in ('compact', 'balanced', 'spacious')]
                check(values[0] < values[1] < values[2], f'Density has no real geometry effect: {values}')

        for width, height in ((1280, 800), (1600, 1000), (1920, 1080), (2048, 1320), (390, 844), (320, 740)):
            load('zh-CN-balanced.paged.html', width, height)
            check(page.locator('[data-page-previous]').inner_text().endswith('上一页'), 'Chinese navigation labels missing')
            for index in range(page.evaluate('ReportifyPresentation.pageCount()')):
                page.evaluate('(i) => ReportifyPresentation.goToPage(i)', index)
                audit = page.evaluate('Reportify.runAudit()')
                receipt['pageAudits'] += 1
                check(audit['accepted'], f'Chinese {width} page {index + 1}: {audit["errors"] + audit["warnings"]}')
            if width == 1600:
                page.evaluate('ReportifyPresentation.goToPage(1)')
                screenshot('zh-CN-1600-hierarchy.png')

        load('executive-blue-balanced.paged.html')
        total = page.evaluate('ReportifyPresentation.pageCount()')
        check(current() == 1, 'Initial page is not 1')
        check(page.locator('[data-page-previous]').is_disabled(), 'Previous should be disabled at the start')
        page.locator('[data-page-next]').click()
        check(current() == 2, 'Next button did not advance')
        page.locator('[data-page-previous]').click()
        check(current() == 1, 'Previous button did not return')
        page.evaluate('document.activeElement.blur()')
        for key, expected in [('ArrowRight', 2), ('PageDown', 3), ('ArrowLeft', 2), ('PageUp', 1), ('Space', 2), ('End', total), ('Home', 1)]:
            page.keyboard.press(key)
            check(current() == expected, f'{key}: unexpected page {current()}')
        page.keyboard.press('End')
        check(page.locator('[data-page-next]').is_disabled(), 'Next should be disabled at the end')
        page.keyboard.press('Home')
        page.locator('.report-nav a[href="#findings"]').click()
        page.locator('.report-page[data-active="true"] .evidence-link').first.click()
        check(page.locator('.report-page[data-active="true"] #source-s6').count() == 1, 'Evidence anchor did not navigate to the correct source page')
        ids = page.locator('[id]').evaluate_all('(els) => els.map(el => el.id)')
        check(len(ids) == len(set(ids)), 'Page compilation duplicated DOM IDs')
        for selector, expected in [('.timeline', [3, 3]), ('.compact-list', [3, 3]), ('.table-wrap tbody', [5, 4]), ('.sources-ledger', [4, 3])]:
            actual = page.locator(selector).evaluate_all('(els) => els.map(el => el.children.length)')
            check(actual == expected, f'Unbalanced pagination for {selector}: {actual}')
        page.locator('[data-presentation-view-toggle]').click()
        check(page.locator('.report-page:visible').count() == total, 'Scroll view hid pages')
        page.locator('.report-nav a[href="#inventory"]').click()
        check(page.locator('.report-page[data-active="true"]').count() == total, 'Anchor changed scroll view visibility state')
        scroll_target = current()
        page.locator('[data-presentation-view-toggle]').click()
        check(current() == scroll_target and page.locator('.report-page:visible').count() == 1, 'View toggle lost the selected page')
        for value in ('NaN', 'Infinity', '"invalid"'):
            before = current()
            page.evaluate(f'ReportifyPresentation.goToPage({value})')
            check(current() == before, 'Invalid page index corrupted navigation')
        page.evaluate('ReportifyPresentation.goToPage(1.9)')
        check(current() == 2, 'Fractional page index was not normalized')
        load('executive-blue-balanced.paged.html', fragment='#%')
        check(current() == 1, 'Malformed fragment prevented initialization')

        load('executive-blue-balanced.paged.html', 390, 844)
        page.locator('.report-nav a[href="#inventory"]').click()

        def gesture(selector, dx, dy, cancel=False, multi=False):
            page.eval_on_selector(selector, '''(el, arg) => {
              const t = (x,y,id=1) => new Touch({identifier:id, target:el, clientX:x, clientY:y});
              const first = t(240,240);
              const touches = arg.multi ? [first,t(200,200,2)] : [first];
              el.dispatchEvent(new TouchEvent('touchstart', {bubbles:true, touches, changedTouches:touches}));
              if (arg.cancel) el.dispatchEvent(new TouchEvent('touchcancel', {bubbles:true, touches:[], changedTouches:[first]}));
              el.dispatchEvent(new TouchEvent('touchend', {bubbles:true, touches:[], changedTouches:[t(240+arg.dx,240+arg.dy)]}));
            }''', {'dx': dx, 'dy': dy, 'cancel': cancel, 'multi': multi})

        before = current()
        gesture('.report-page[data-active="true"] .table-wrap', -100, 0)
        check(current() == before, 'Horizontal table scrolling triggered page navigation')
        gesture('.report-page[data-active="true"] .section-heading', -100, 180)
        check(current() == before, 'Vertical scrolling triggered page navigation')
        gesture('.report-page[data-active="true"] .section-heading', -100, 0, cancel=True)
        check(current() == before, 'Cancelled touch triggered navigation')
        gesture('.report-page[data-active="true"] .section-heading', -100, 0, multi=True)
        check(current() == before, 'Multi-touch triggered navigation')
        gesture('.report-page[data-active="true"] .section-heading', -100, 0)
        check(current() == before + 1, 'Intentional horizontal swipe did not advance')

        load('executive-blue-balanced.paged.html')
        before_theme = page.evaluate('getComputedStyle(document.body).color')
        page.locator('[data-theme-toggle]').click()
        check(page.evaluate('getComputedStyle(document.body).color') != before_theme, 'Theme toggle had no visual effect')
        page.locator('[data-theme-toggle]').click()
        check(page.evaluate('getComputedStyle(document.body).color') == before_theme, 'Theme toggle did not restore light colors')
        page.emulate_media(media='print')
        check(page.locator('.report-page:visible').count() == total, 'Print styles hid presentation pages')
        check(not page.locator('.presentation-controls').is_visible(), 'Print styles included navigation controls')
        page.emulate_media(media='screen')
        page.locator('.report-nav a[href="#cards"]').click()
        page.add_style_tag(content='.report-page[data-active="true"] .report-card:first-child { min-height: 520px !important; }')
        audit = page.evaluate('Reportify.runAudit()')
        check(not audit['accepted'] and any(w['code'] == 'LOW_VERTICAL_FILL' for w in audit['warnings']), 'Showcase failed open on low vertical fill')
        page.evaluate('document.documentElement.dataset.qualityProfile="standard"')
        check(page.evaluate('Reportify.runAudit()')['accepted'], 'Standard profile warning compatibility changed')
        check(not runtime_errors, f'Browser runtime errors: {runtime_errors}')
        browser.close()

    receipt['accepted'] = True
    (directory / 'quality-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
