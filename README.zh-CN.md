# Reportify

Reportify 是一个用于生成高质量、可演示、可审计的单文件 HTML 汇报的 Agent Skill，同时也是一套零 npm 运行时依赖的 Node.js 渲染与质量校验工具。

它的目标不只是“生成一张很长的 HTML 页面”，而是让 Agent 能稳定产出真正适合汇报演示的报告：布局合理、前后风格一致、可以翻页、明确显示当前页/总页数，并且在交付前逐页通过真实浏览器检查。

## 核心架构

```text
自然语言 / 源文档 / 项目事实
              ↓
       Agent 生成 Typed JSON
              ↓
      Schema 与语义关系校验
              ↓
     确定性内容权重布局编译器
              ↓
          HTML Renderer
              ↓
      Presentation Page Compiler
              ↓
  单文件 HTML / 分页演示 / 滚动阅读
              ↓
 Playwright 逐页 DOM 检查 + 逐页截图
              ↓
          原子提交最终产物
```

大模型负责“汇报说什么”，Reportify 负责“内容应该怎样排、怎样分页、怎样验收”。

## 两种交付模式

### 1. Presentation：分页演示

这是正式汇报、项目复盘、决策简报、研究汇报的推荐模式。

```bash
node bin/reportify-present.mjs \
  examples/executive-status.report.json \
  output/report.html \
  --quality showcase
```

生成的 HTML 默认进入分页模式，并提供：

- 上一页 / 下一页；
- `当前页 / 总页数`；
- `←` / `→`、`PageUp` / `PageDown`、`Home` / `End`、空格翻页；
- 手机左右滑动；
- 顶部章节导航跳转到对应页面；
- 证据链接可以跨页跳到来源页；
- 分页 / 滚动模式一键切换；
- 打印时自动展开全部页面并分页打印。

Page Compiler 不会简单按像素把内容从中间截断。它把卡片、列表项、时间线节点、流程节点、表格行和来源条目视为分页原子，优先在安全边界拆页。

典型分页上限：

- 普通卡片：每页最多 6 项；
- 对比卡片：每页最多 4 项；
- findings / actions 紧凑列表：每页最多 5 项；
- 时间线：每页最多 5 项；
- 流程：每页最多 5 步；
- 表格：每页最多 8 行，并保留表头；
- 来源：每页最多 6 项。

对于 4、5、6 张卡片，分页样式会优先形成 `2×2`、`3+2`、`3×2`，避免常见的 `4+1` 孤儿卡片布局。

### 2. Report：滚动阅读

需要长页阅读、存档或传统 HTML 报告时仍可使用原来的交付命令：

```bash
node bin/reportify.mjs deliver \
  examples/executive-status.report.json \
  output/report.html \
  --quality showcase
```

Presentation 产物本身也可以通过顶部按钮切换为滚动模式，或者使用 URL 参数 `?view=scroll`。

## 为什么布局更稳定

普通文本卡片默认始终使用内容自然高度：

```css
.report-card {
  height: auto;
  min-height: 0;
  align-self: start;
}
```

只有真正的同维度方案比较才允许等高。布局编译器还会根据标题、正文、列表、元数据和比较字段估算内容权重：

- 一项短内容 → 紧凑横条；
- 两项均衡内容 → 两列；
- 三项均衡内容 → 三列；
- 三项中一项明显更重 → 主卡 + 两张紧凑侧卡；
- 五至六项 → 自适应内容高度卡片；
- 七项以上 → 紧凑列表；
- 同构密集数据 → 表格；
- 方案比较 → 共享维度比较表。

默认使用 `layout: "auto"`。只有确实需要固定结构时才覆盖布局。

## Presentation 质量门禁

`reportify-present` 会在正式替换输出文件之前，使用 Python Playwright 对每个演示页面逐页执行浏览器验收，并逐页截图。

在原有质量检查基础上，Presentation 模式新增：

- `PAGE_COUNT_MISMATCH`：页面状态和显示的当前页/总页数不一致；
- `PAGE_VERTICAL_OVERFLOW`：桌面演示页超过安全可视高度，需要滚动；
- `ORPHAN_GRID_ITEM`：最后一行只有一张孤立卡片，页面构图失衡。

原有浏览器检查仍然继续执行：

- `PAGE_HORIZONTAL_OVERFLOW`
- `TEXT_CLIPPED`
- `ELEMENT_OVERLAP`
- `LOW_VERTICAL_FILL`
- `ROW_CONTENT_IMBALANCE`
- `TINY_TEXT`
- `EMPTY_SECTION`
- `BROKEN_EVIDENCE_REF`
- `UNSUPPORTED_HEADLINE_NUMBER`
- `PLACEHOLDER_CONTENT`

`showcase` 模式下，任何错误或布局质量告警都会阻止最终交付。失败候选会保留用于排查，上一版最终 HTML 不会被覆盖。

## 环境要求

- Node.js 20+
- Python 3 + Playwright（分页演示的逐页验收要求）
- Chromium、Google Chrome 或 Microsoft Edge

```bash
python -m pip install playwright
python -m playwright install chromium
```

普通 `deliver` 可以使用 Chromium CLI 回退；正式 Presentation 逐页验收要求 Python Playwright。

## 快速开始

检查环境：

```bash
node bin/reportify.mjs doctor
```

验证 Typed JSON：

```bash
node bin/reportify.mjs validate examples/executive-status.report.json \
  --quality showcase
```

生成普通滚动报告：

```bash
npm run deliver:example
```

生成分页演示报告：

```bash
npm run present:example
```

运行测试：

```bash
npm test
```

## 支持的汇报类型

顶层 `meta.archetype` 支持：

- `status`：项目状态、阶段进展、运营复盘；
- `decision`：方案选型、比较与决策简报；
- `research`：调研分析、研究结论与证据汇总。

章节 `kind` 支持：

- `summary`
- `status`
- `findings`
- `comparison`
- `timeline`
- `table`
- `flow`
- `actions`
- `text`

## 设计原则

Reportify 的目标不是通过固定高度、填充废话、缩小字体或 `overflow: hidden` 来制造“整齐”。它遵循以下原则：

1. 内容真实性优先，不为排版编造事实；
2. 普通卡片使用自然高度；
3. 布局由内容权重和语义结构决定；
4. 分页只在安全内容边界发生；
5. 页面构图避免明显孤儿项和失衡；
6. 自动检查建立客观质量下限，逐页截图用于最终审美复核；
7. 浏览器验收没有通过，就不替换最终产物。

## 作为 Agent Skill 安装

### Codex

```bash
npx -y skills add CodeMarker0/Reportify --skill reportify --agent codex --global --copy --yes
```

### Claude Code

```bash
npx -y skills add CodeMarker0/Reportify --skill reportify --agent claude-code --global --copy --yes
```

## 进一步阅读

- `SKILL.md`：Agent 使用合同；
- `references/authoring-contract.md`：Typed JSON 编写规范；
- `references/layout-contract.md`：自动布局与修复顺序；
- `references/delivery-contract.md`：浏览器验收、回执和原子交付；
- `schemas/report.schema.json`：完整字段定义。
