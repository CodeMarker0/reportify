(function () {
  'use strict';

  const runtimeErrors = [];
  window.addEventListener('error', (event) => {
    runtimeErrors.push(String(event.message || event.error || 'Unknown runtime error'));
  });
  window.addEventListener('unhandledrejection', (event) => {
    runtimeErrors.push(String(event.reason || 'Unhandled promise rejection'));
  });

  const root = document.documentElement;
  const params = new URLSearchParams(window.location.search);
  const forcedTheme = params.get('theme');
  if (forcedTheme === 'dark' || forcedTheme === 'light') {
    root.dataset.colorMode = forcedTheme;
  }

  const themeButton = document.querySelector('[data-theme-toggle]');
  if (themeButton) {
    const updateThemeLabel = () => {
      const dark = root.dataset.colorMode ? root.dataset.colorMode === 'dark' : root.dataset.theme === 'midnight';
      themeButton.textContent = dark
        ? (themeButton.dataset.labelLight || 'Light')
        : (themeButton.dataset.labelDark || 'Dark');
      themeButton.setAttribute('aria-pressed', dark ? 'true' : 'false');
    };

    themeButton.addEventListener('click', () => {
      const dark = root.dataset.colorMode ? root.dataset.colorMode === 'dark' : root.dataset.theme === 'midnight';
      root.dataset.colorMode = dark ? 'light' : 'dark';
      updateThemeLabel();
    });
    updateThemeLabel();
  }

  const printButton = document.querySelector('[data-print-report]');
  if (printButton) printButton.addEventListener('click', () => window.print());

  const navLinks = [...document.querySelectorAll('.report-nav a[href^="#"]')];
  if ('IntersectionObserver' in window && navLinks.length) {
    const byId = new Map(navLinks.map((link) => [link.getAttribute('href').slice(1), link]));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      for (const link of navLinks) link.removeAttribute('aria-current');
      const active = byId.get(visible.target.id);
      if (active) active.setAttribute('aria-current', 'true');
    }, { rootMargin: '-18% 0px -68% 0px', threshold: [0.01, 0.2, 0.5] });
    document.querySelectorAll('[data-report-section]').forEach((section) => observer.observe(section));
  }

  function rectIntersection(a, b) {
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.right, b.right);
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.bottom, b.bottom);
    if (right <= left || bottom <= top) return 0;
    return (right - left) * (bottom - top);
  }

  function isVisible(element) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function issue(level, code, subject, message, evidence, supportedFixes) {
    return {
      level,
      code,
      subject,
      message,
      ...(evidence ? { evidence } : {}),
      ...(supportedFixes ? { supportedFixes } : {}),
    };
  }

  async function runAudit() {
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch (_) {
      // System fonts remain usable even if the FontFaceSet promise is unavailable.
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const errors = [];
    const warnings = [];
    const doc = document.documentElement;
    const viewport = { width: window.innerWidth, height: window.innerHeight };

    const overflowX = Math.max(0, doc.scrollWidth - doc.clientWidth);
    if (overflowX > 1) {
      errors.push(issue(
        'error',
        'PAGE_HORIZONTAL_OVERFLOW',
        'document',
        'The page is wider than the viewport.',
        { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, overflowX },
        ['wrap-long-token', 'stack-narrow-layout', 'bound-wide-table-or-diagram'],
      ));
    }

    const sections = [...document.querySelectorAll('[data-report-section]')];
    for (const section of sections) {
      const content = section.querySelector('[data-section-content]');
      if (!content || !content.children.length) {
        errors.push(issue(
          'error',
          'EMPTY_SECTION',
          `section:${section.id || 'unknown'}`,
          'Rendered section has no content.',
          undefined,
          ['add-content', 'remove-empty-section'],
        ));
      }
    }

    const textCandidates = [...document.querySelectorAll('[data-check-text], h1, h2, h3, p, li, td, th')];
    for (const element of textCandidates) {
      if (!isVisible(element)) continue;
      const style = getComputedStyle(element);
      const clipsY = /hidden|clip/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      const clipsX = /hidden|clip/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
      if (clipsX || clipsY) {
        errors.push(issue(
          'error',
          'TEXT_CLIPPED',
          element.dataset.auditSubject || element.id || element.tagName.toLowerCase(),
          'Text content is clipped by overflow rules.',
          {
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
          },
          ['remove-hidden-overflow', 'split-content', 'change-layout'],
        ));
      }
    }

    const blocks = [...document.querySelectorAll('[data-report-block]')];
    for (const block of blocks) {
      if (!isVisible(block)) continue;
      if (block.dataset.fillPolicy === 'sparse-ok') continue;
      const content = block.querySelector('[data-block-content]');
      if (!content || !isVisible(content)) continue;
      const rect = block.getBoundingClientRect();
      if (rect.height <= 220) continue;
      const contentRect = content.getBoundingClientRect();
      const style = getComputedStyle(block);
      const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
      const paddingTop = Number.parseFloat(style.paddingTop) || 0;
      const usableHeight = Math.max(1, rect.height - paddingTop - paddingBottom);
      const bottomGap = Math.max(0, rect.bottom - paddingBottom - contentRect.bottom);
      const emptyRatio = bottomGap / usableHeight;
      if (bottomGap > 72 && emptyRatio > 0.35) {
        warnings.push(issue(
          'warning',
          'LOW_VERTICAL_FILL',
          block.dataset.auditSubject || 'report-block',
          'A tall content block leaves a large continuous empty area below its content.',
          {
            height: Number(rect.height.toFixed(1)),
            contentHeight: Number(contentRect.height.toFixed(1)),
            bottomGap: Number(bottomGap.toFixed(1)),
            emptyRatio: Number(emptyRatio.toFixed(3)),
          },
          ['remove-equal-height', 'use-compact-strip', 'use-featured-stack', 'merge-related-items', 'split-section'],
        ));
      }
    }

    const equalGroups = [...document.querySelectorAll('[data-equal-height-group]')];
    for (const group of equalGroups) {
      const children = [...group.querySelectorAll(':scope > [data-report-block]')].filter(isVisible);
      const rows = [];
      for (const child of children) {
        const rect = child.getBoundingClientRect();
        let row = rows.find((entry) => Math.abs(entry.top - rect.top) <= 4);
        if (!row) {
          row = { top: rect.top, children: [] };
          rows.push(row);
        }
        row.children.push(child);
      }
      for (const row of rows) {
        if (row.children.length < 2) continue;
        const heights = row.children.map((child) => {
          const content = child.querySelector('[data-block-content]');
          return content ? content.getBoundingClientRect().height : child.getBoundingClientRect().height;
        });
        const min = Math.min(...heights);
        const max = Math.max(...heights);
        const ratio = max / Math.max(min, 1);
        if (ratio > 1.8) {
          warnings.push(issue(
            'warning',
            'ROW_CONTENT_IMBALANCE',
            group.dataset.auditSubject || 'equal-height-group',
            'Equal-height comparison items contain substantially different amounts of content.',
            { minContentHeight: Number(min.toFixed(1)), maxContentHeight: Number(max.toFixed(1)), ratio: Number(ratio.toFixed(3)) },
            ['remove-redundant-copy', 'move-shared-copy-outside-options', 'change-to-comparison-table'],
          ));
        }
      }
    }

    for (const section of sections) {
      const boxes = [...section.querySelectorAll('[data-geometry-box]')].filter(isVisible);
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          if (a.contains(b) || b.contains(a)) continue;
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          const area = rectIntersection(aRect, bRect);
          if (area > 16) {
            errors.push(issue(
              'error',
              'ELEMENT_OVERLAP',
              `section:${section.id || 'unknown'}`,
              'Top-level layout boxes overlap.',
              {
                first: a.dataset.auditSubject || a.tagName.toLowerCase(),
                second: b.dataset.auditSubject || b.tagName.toLowerCase(),
                intersectionArea: Number(area.toFixed(1)),
              },
              ['change-grid', 'stack-elements', 'remove-absolute-positioning'],
            ));
          }
        }
      }
    }

    const textNodes = [...document.querySelectorAll('.report-main h1, .report-main h2, .report-main h3, .report-main p, .report-main li, .report-main td, .report-main th, .report-main .metric-label, .report-main .section-note')];
    for (const element of textNodes) {
      if (!isVisible(element) || !String(element.textContent || '').trim()) continue;
      const size = Number.parseFloat(getComputedStyle(element).fontSize) || 0;
      const compact = element.matches('th, .metric-label, .section-note, .eyebrow, .source-note, .source-location, .meta-pill, .status-pill, .priority-pill, .recommendation-pill');
      const minimum = compact ? 11 : 13;
      if (size + 0.01 < minimum) {
        warnings.push(issue(
          'warning',
          'TINY_TEXT',
          element.dataset.auditSubject || element.tagName.toLowerCase(),
          'Rendered text is below the supported readability floor.',
          { fontSize: size, minimum },
          ['split-content', 'change-layout', 'remove-redundant-copy'],
        ));
      }
    }

    for (const message of runtimeErrors) {
      errors.push(issue('error', 'RUNTIME_ERROR', 'window', message));
    }

    const quality = root.dataset.qualityProfile || 'showcase';
    const accepted = errors.length === 0 && (quality === 'standard' || warnings.length === 0);
    const receipt = {
      auditVersion: 1,
      viewport,
      theme: root.dataset.colorMode || root.dataset.theme || 'default',
      quality,
      accepted,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
      document: {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        scrollHeight: doc.scrollHeight,
        clientHeight: doc.clientHeight,
      },
    };

    let receiptNode = document.getElementById('reportify-audit-result');
    if (!receiptNode) {
      receiptNode = document.createElement('script');
      receiptNode.id = 'reportify-audit-result';
      receiptNode.type = 'application/json';
      receiptNode.className = 'audit-hidden';
      document.body.appendChild(receiptNode);
    }
    receiptNode.textContent = JSON.stringify(receipt).replace(/</g, '\\u003c');
    root.dataset.reportifyAuditReady = 'true';
    return receipt;
  }

  window.Reportify = Object.freeze({ runAudit });
  runAudit();
})();
