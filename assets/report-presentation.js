(function () {
  'use strict';

  const root = document.documentElement;
  const lang = (root.getAttribute('lang') || 'en').toLowerCase();
  const zh = lang.startsWith('zh');
  const labels = zh
    ? { previous: '上一页', next: '下一页', paged: '分页', scroll: '滚动', continuation: '续' }
    : { previous: 'Previous', next: 'Next', paged: 'Paged', scroll: 'Scroll', continuation: 'cont.' };

  const CHUNK_LIMITS = Object.freeze({
    cards: 6,
    comparisonCards: 4,
    compactRows: 5,
    timeline: 5,
    flow: 5,
    tableRows: 8,
    sources: 6,
  });

  let pages = [];
  let currentIndex = 0;
  let controls = null;
  let currentNode = null;
  let totalNode = null;
  let previousButton = null;
  let nextButton = null;
  let viewButton = null;
  let touchStartX = null;
  let initialized = false;

  function chunk(values, size) {
    const result = [];
    for (let index = 0; index < values.length; index += size) {
      result.push(values.slice(index, index + size));
    }
    return result.length ? result : [[]];
  }

  function addContinuation(section, part, total) {
    if (total <= 1) return;
    const heading = section.querySelector('.section-heading h2');
    if (!heading) return;
    const marker = document.createElement('span');
    marker.className = 'presentation-continuation';
    marker.textContent = zh
      ? `（${labels.continuation} ${part}/${total}）`
      : `(${labels.continuation} ${part}/${total})`;
    heading.appendChild(marker);
  }

  function normalizeSectionId(section, sourceId, part) {
    section.id = part === 1 ? sourceId : `${sourceId}--part-${part}`;
    section.dataset.presentationSourceSection = sourceId;
    section.dataset.presentationPart = String(part);
  }

  function makeChunkedSections(section, selector, itemSelector, limit, rebuild) {
    const sourceId = section.id || `section-${Math.random().toString(36).slice(2)}`;
    const container = section.querySelector(selector);
    if (!container) return [section];
    const items = [...container.querySelectorAll(itemSelector)];
    if (items.length <= limit) return [section];

    const groups = chunk(items, limit);
    return groups.map((group, index) => {
      const clone = section.cloneNode(true);
      normalizeSectionId(clone, sourceId, index + 1);
      addContinuation(clone, index + 1, groups.length);
      const cloneContainer = clone.querySelector(selector);
      if (rebuild) rebuild(cloneContainer, group, clone);
      else cloneContainer.replaceChildren(...group.map((item) => item.cloneNode(true)));
      return clone;
    });
  }

  function paginateTable(section) {
    const table = section.querySelector('.table-wrap table');
    if (!table) return [section];
    const rows = [...table.querySelectorAll('tbody > tr')];
    if (rows.length <= CHUNK_LIMITS.tableRows) return [section];
    const sourceId = section.id || 'table-section';
    const groups = chunk(rows, CHUNK_LIMITS.tableRows);
    return groups.map((group, index) => {
      const clone = section.cloneNode(true);
      normalizeSectionId(clone, sourceId, index + 1);
      addContinuation(clone, index + 1, groups.length);
      const tbody = clone.querySelector('.table-wrap table tbody');
      tbody.replaceChildren(...group.map((row) => row.cloneNode(true)));
      return clone;
    });
  }

  function paginateFlow(section) {
    return makeChunkedSections(
      section,
      '.flow',
      ':scope > .flow-step',
      CHUNK_LIMITS.flow,
      (container, group) => {
        const rebuilt = [];
        group.forEach((step, index) => {
          rebuilt.push(step.cloneNode(true));
          if (index < group.length - 1) {
            const arrow = document.createElement('span');
            arrow.className = 'flow-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            arrow.textContent = '→';
            rebuilt.push(arrow);
          }
        });
        container.replaceChildren(...rebuilt);
      },
    );
  }

  function paginateSection(section) {
    if (section.id === 'sources' || section.dataset.kind === 'sources') {
      return makeChunkedSections(section, '.sources-ledger', ':scope > .source-entry', CHUNK_LIMITS.sources);
    }
    if (section.querySelector('.compact-list')) {
      return makeChunkedSections(section, '.compact-list', ':scope > .compact-row', CHUNK_LIMITS.compactRows);
    }
    if (section.querySelector('.comparison-card-grid')) {
      return makeChunkedSections(
        section,
        '.comparison-card-grid',
        ':scope > .report-card',
        CHUNK_LIMITS.comparisonCards,
        (container, group) => {
          container.dataset.presentationCount = String(group.length);
          container.replaceChildren(...group.map((item) => item.cloneNode(true)));
        },
      );
    }
    if (section.querySelector('.card-grid')) {
      return makeChunkedSections(
        section,
        '.card-grid',
        ':scope > .report-card',
        CHUNK_LIMITS.cards,
        (container, group) => {
          container.dataset.presentationCount = String(group.length);
          container.replaceChildren(...group.map((item) => item.cloneNode(true)));
        },
      );
    }
    if (section.querySelector('.timeline')) {
      return makeChunkedSections(section, '.timeline', ':scope > .timeline-item', CHUNK_LIMITS.timeline);
    }
    if (section.querySelector('.flow')) return paginateFlow(section);
    if (section.querySelector('.table-wrap table')) return paginateTable(section);
    return [section];
  }

  function createPage(content, kind, index) {
    const page = document.createElement('article');
    page.className = 'report-page';
    page.dataset.reportPage = '';
    page.dataset.pageKind = kind;
    page.dataset.pageIndex = String(index);
    page.dataset.active = 'false';
    const inner = document.createElement('div');
    inner.className = 'report-page-content';
    inner.dataset.pageContent = '';
    inner.appendChild(content);
    page.appendChild(inner);
    return page;
  }

  function compilePages() {
    const main = document.querySelector('.report-main');
    if (!main) return [];
    const originalChildren = [...main.children];
    const compiled = [];

    for (const child of originalChildren) {
      if (child.classList.contains('report-hero')) {
        compiled.push(createPage(child, 'cover', compiled.length));
        continue;
      }
      if (child.matches('[data-report-section], .report-section')) {
        const parts = paginateSection(child);
        parts.forEach((part) => compiled.push(createPage(part, 'section', compiled.length)));
        continue;
      }
      compiled.push(createPage(child, 'content', compiled.length));
    }

    main.replaceChildren(...compiled);
    return compiled;
  }

  function updateGridCounts(page) {
    page.querySelectorAll('.card-grid, .comparison-card-grid').forEach((grid) => {
      const selector = grid.classList.contains('comparison-card-grid') ? ':scope > .report-card' : ':scope > .report-card';
      grid.dataset.presentationCount = String(grid.querySelectorAll(selector).length);
    });
  }

  function buildControls() {
    const shell = document.querySelector('.report-shell') || document.body;
    controls = document.createElement('div');
    controls.className = 'presentation-controls presentation-only';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', zh ? '报告翻页' : 'Report pagination');

    previousButton = document.createElement('button');
    previousButton.type = 'button';
    previousButton.className = 'presentation-button';
    previousButton.dataset.pagePrevious = '';
    previousButton.textContent = `← ${labels.previous}`;

    const indicator = document.createElement('span');
    indicator.className = 'presentation-page-indicator';
    indicator.setAttribute('aria-live', 'polite');
    currentNode = document.createElement('span');
    currentNode.className = 'presentation-page-current';
    const slash = document.createElement('span');
    slash.textContent = '/';
    totalNode = document.createElement('span');
    totalNode.className = 'presentation-page-total';
    indicator.append(currentNode, slash, totalNode);

    nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'presentation-button';
    nextButton.dataset.pageNext = '';
    nextButton.textContent = `${labels.next} →`;

    controls.append(previousButton, indicator, nextButton);
    shell.appendChild(controls);

    previousButton.addEventListener('click', () => goToPage(currentIndex - 1));
    nextButton.addEventListener('click', () => goToPage(currentIndex + 1));
  }

  function buildViewToggle() {
    const actions = document.querySelector('.report-actions');
    if (!actions) return;
    viewButton = document.createElement('button');
    viewButton.type = 'button';
    viewButton.className = 'icon-button';
    viewButton.dataset.presentationViewToggle = '';
    actions.prepend(viewButton);
    viewButton.addEventListener('click', () => {
      const next = root.dataset.reportView === 'paged' ? 'scroll' : 'paged';
      setView(next);
    });
  }

  function setView(view) {
    const normalized = view === 'scroll' ? 'scroll' : 'paged';
    root.dataset.reportView = normalized;
    if (viewButton) viewButton.textContent = normalized === 'paged' ? labels.scroll : labels.paged;
    if (normalized === 'paged') {
      pages.forEach((page, index) => { page.dataset.active = index === currentIndex ? 'true' : 'false'; });
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      pages.forEach((page) => { page.dataset.active = 'true'; });
    }
    updateControls();
  }

  function updateNav() {
    const page = pages[currentIndex];
    const section = page && page.querySelector('[data-report-section], .report-section');
    const sourceId = section && (section.dataset.presentationSourceSection || section.id);
    document.querySelectorAll('.report-nav a[href^="#"]').forEach((link) => {
      const active = sourceId && link.getAttribute('href') === `#${sourceId}`;
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  function updateControls() {
    if (!pages.length) return;
    if (currentNode) currentNode.textContent = String(currentIndex + 1);
    if (totalNode) totalNode.textContent = String(pages.length);
    if (previousButton) previousButton.disabled = currentIndex <= 0;
    if (nextButton) nextButton.disabled = currentIndex >= pages.length - 1;
    updateNav();
  }

  function goToPage(index, options) {
    if (!pages.length) return 0;
    const clamped = Math.max(0, Math.min(index, pages.length - 1));
    currentIndex = clamped;
    pages.forEach((page, pageIndex) => { page.dataset.active = pageIndex === clamped ? 'true' : 'false'; });
    updateControls();
    if (root.dataset.reportView === 'paged') {
      const behavior = options && options.instant ? 'auto' : 'smooth';
      window.scrollTo({ top: 0, behavior });
    }
    return currentIndex;
  }

  function pageForTarget(target) {
    return pages.findIndex((page) => page.contains(target));
  }

  function installAnchorNavigation() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      let target;
      try { target = document.querySelector(href); } catch (_) { return; }
      if (!target) return;
      const pageIndex = pageForTarget(target);
      if (pageIndex < 0) return;
      event.preventDefault();
      goToPage(pageIndex);
      if (root.dataset.reportView === 'scroll') target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (history && history.replaceState) history.replaceState(null, '', href);
    });
  }

  function installKeyboardNavigation() {
    window.addEventListener('keydown', (event) => {
      if (root.dataset.reportView !== 'paged') return;
      const target = event.target;
      if (target && target.matches('input, textarea, select, button, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        goToPage(currentIndex + 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        goToPage(currentIndex - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        goToPage(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        goToPage(pages.length - 1);
      }
    });
  }

  function installSwipeNavigation() {
    window.addEventListener('touchstart', (event) => {
      if (root.dataset.reportView !== 'paged' || event.touches.length !== 1) return;
      touchStartX = event.touches[0].clientX;
    }, { passive: true });
    window.addEventListener('touchend', (event) => {
      if (root.dataset.reportView !== 'paged' || touchStartX === null || !event.changedTouches.length) return;
      const delta = event.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(delta) < 54) return;
      if (delta < 0) goToPage(currentIndex + 1);
      else goToPage(currentIndex - 1);
    }, { passive: true });
  }

  function activePage() {
    return pages[currentIndex] || null;
  }

  function presentationIssues() {
    const errors = [];
    const warnings = [];
    const page = activePage();
    if (!page) return { errors, warnings };

    const currentDisplayed = Number.parseInt(currentNode && currentNode.textContent, 10);
    const totalDisplayed = Number.parseInt(totalNode && totalNode.textContent, 10);
    if (currentDisplayed !== currentIndex + 1 || totalDisplayed !== pages.length) {
      errors.push({
        level: 'error',
        code: 'PAGE_COUNT_MISMATCH',
        subject: `page:${currentIndex + 1}`,
        message: 'The visible page indicator does not match the compiled page state.',
        evidence: { currentDisplayed, expectedCurrent: currentIndex + 1, totalDisplayed, expectedTotal: pages.length },
      });
    }

    if (window.innerWidth >= 900 && root.dataset.reportView === 'paged') {
      const topbar = document.querySelector('.report-topbar');
      const controlsRect = controls ? controls.getBoundingClientRect() : { height: 0 };
      const topbarRect = topbar ? topbar.getBoundingClientRect() : { bottom: 0, height: 0 };
      const content = page.querySelector('[data-page-content]');
      if (content) {
        const contentRect = content.getBoundingClientRect();
        const safeHeight = Math.max(320, window.innerHeight - Math.max(topbarRect.bottom, topbarRect.height) - controlsRect.height - 42);
        if (contentRect.height > safeHeight + 28) {
          warnings.push({
            level: 'warning',
            code: 'PAGE_VERTICAL_OVERFLOW',
            subject: `page:${currentIndex + 1}`,
            message: 'The presentation page is taller than the safe viewport height and may require scrolling during a presentation.',
            evidence: { contentHeight: Number(contentRect.height.toFixed(1)), safeHeight: Number(safeHeight.toFixed(1)) },
            supportedFixes: ['split-section', 'reduce-items-per-page', 'use-compact-layout'],
          });
        }
      }
    }

    page.querySelectorAll('.card-grid, .comparison-card-grid, .layout-two-column, .layout-three-column').forEach((grid) => {
      const children = [...grid.children].filter((child) => child.getBoundingClientRect().width > 0 && child.getBoundingClientRect().height > 0);
      if (children.length < 4) return;
      const rows = [];
      children.forEach((child) => {
        const rect = child.getBoundingClientRect();
        let row = rows.find((candidate) => Math.abs(candidate.top - rect.top) <= 4);
        if (!row) {
          row = { top: rect.top, count: 0 };
          rows.push(row);
        }
        row.count += 1;
      });
      if (rows.length > 1 && rows[rows.length - 1].count === 1) {
        warnings.push({
          level: 'warning',
          code: 'ORPHAN_GRID_ITEM',
          subject: `page:${currentIndex + 1}`,
          message: 'The final grid row contains a single orphan card, creating an unbalanced page composition.',
          evidence: { itemCount: children.length, rowCounts: rows.map((row) => row.count) },
          supportedFixes: ['use-balanced-column-count', 'split-section', 'change-layout'],
        });
      }
    });

    return { errors, warnings };
  }

  function patchAudit() {
    const original = window.Reportify;
    if (!original || typeof original.runAudit !== 'function' || original.__presentationPatched) return;
    const baseRunAudit = original.runAudit.bind(original);
    const enhancedRunAudit = async function () {
      const receipt = await baseRunAudit();
      const extra = presentationIssues();
      receipt.errors = [...(receipt.errors || []), ...extra.errors];
      receipt.warnings = [...(receipt.warnings || []), ...extra.warnings];
      receipt.errorCount = receipt.errors.length;
      receipt.warningCount = receipt.warnings.length;
      receipt.presentation = {
        enabled: true,
        view: root.dataset.reportView || 'paged',
        page: currentIndex + 1,
        pageCount: pages.length,
      };
      receipt.accepted = receipt.errorCount === 0 && (receipt.quality === 'standard' || receipt.warningCount === 0);
      const node = document.getElementById('reportify-audit-result');
      if (node) node.textContent = JSON.stringify(receipt).replace(/</g, '\\u003c');
      return receipt;
    };
    window.Reportify = Object.freeze({ runAudit: enhancedRunAudit, __presentationPatched: true });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    root.dataset.reportifyPresentation = 'true';
    pages = compilePages();
    if (!pages.length) return;
    pages.forEach(updateGridCounts);
    buildControls();
    buildViewToggle();
    installAnchorNavigation();
    installKeyboardNavigation();
    installSwipeNavigation();

    const queryView = new URLSearchParams(window.location.search).get('view');
    const initialView = queryView === 'scroll' ? 'scroll' : 'paged';
    const hashTarget = window.location.hash ? document.querySelector(window.location.hash) : null;
    const hashPage = hashTarget ? pageForTarget(hashTarget) : -1;
    if (hashPage >= 0) currentIndex = hashPage;
    goToPage(currentIndex, { instant: true });
    setView(initialView);
    patchAudit();
    root.dataset.reportifyPresentationReady = 'true';
  }

  window.ReportifyPresentation = Object.freeze({
    goToPage: (index) => goToPage(Number(index), { instant: true }),
    pageCount: () => pages.length,
    currentPage: () => currentIndex + 1,
    setView,
    ready: () => initialized,
  });

  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(init)));
})();
