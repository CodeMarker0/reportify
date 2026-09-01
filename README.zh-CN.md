# Reportify

Reportify 是一个用于生成高质量、单文件 HTML 汇报的 Agent Skill，同时也是一套零 npm 依赖的 Node.js 渲染与质量校验工具。

它重点解决大模型自由生成 HTML 时常见的问题：

- 一个很高的卡片只有顶部几行文字，下半部分大面积留空；
- 为了“整齐”而把内容量差异很大的卡片强制等高；
- 使用 `overflow: hidden` 把超出内容直接裁掉；
- 为了塞进固定布局而把正文缩得过小；
- 数据、结论和来源无法对应；
- HTML 源码看着没问题，但真实浏览器中重叠或溢出。

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
      单文件 HTML/CSS/JavaScript
              ↓
  Chromium DOM 几何检查 + 多视口截图
              ↓
          原子提交最终产物
```

大模型负责“汇报说什么”，Reportify 负责“内容应该怎样排”。

## 环境要求

- Node.js 20+
- Chromium、Google Chrome 或 Microsoft Edge
- 推荐安装 Python 3 + Playwright，用于稳定执行真实浏览器验收

```bash
python -m pip install playwright
```

如果本机没有兼容浏览器，再执行：

```bash
python -m playwright install chromium
```

Reportify 不需要安装任何 npm 依赖。

## 作为 Agent Skill 安装

Reportify 遵循标准的 Agent Skills `SKILL.md` 格式。OpenAI Skills 采用这一开放格式，因此同一个公开仓库可以同时用于 Codex 与 Claude Code。

### Codex

```bash
npx -y skills add CodeMarker0/Reportify --skill reportify --agent codex --global --copy --yes
```

### Claude Code

```bash
npx -y skills add CodeMarker0/Reportify --skill reportify --agent claude-code --global --copy --yes
```

项目级 Claude Code 也可以直接复制到 `.claude/skills/reportify/`，确保 `SKILL.md` 位于该 Skill 根目录。

### 自动识别兼容 Agent

```bash
npx -y skills add CodeMarker0/Reportify
```

Reportify 的运行时不依赖具体 Agent：Codex 与 Claude Code 最终调用相同的 Node.js CLI、确定性渲染器和浏览器质量门禁。

## 快速开始

检查环境：

```bash
node bin/reportify.mjs doctor
```

验证 JSON：

```bash
node bin/reportify.mjs validate examples/executive-status.report.json \
  --quality showcase
```

生成并执行完整浏览器验收：

```bash
node bin/reportify.mjs deliver \
  examples/executive-status.report.json \
  output/report.html \
  --quality showcase
```

生成三套示例：

```bash
node bin/reportify.mjs demo ./demo-output
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

## 为什么能避免“大框少字”

普通文本卡片默认始终使用内容自然高度：

```css
.report-card {
  height: auto;
  min-height: 0;
  align-self: start;
}
```

只有真正的同维度方案比较才允许等高，而且浏览器还会比较每张卡片的真实内容高度。

Reportify 会测量每个主要内容块。如果一个普通卡片：

- 高度超过 220px；
- 底部连续空白超过 72px；
- 空白占可用内部高度 35% 以上；

就会产生 `LOW_VERTICAL_FILL`，在 `showcase` 模式下阻止交付。

## 自动布局

布局编译器会根据标题、正文、列表、元数据和比较字段估算内容权重：

- 一项短内容 → 紧凑横条；
- 两项均衡内容 → 两列；
- 三项均衡内容 → 三列；
- 三项中一项明显更重 → 主卡 + 两张紧凑侧卡；
- 五至六项 → 自适应内容高度卡片；
- 七项以上 → 紧凑列表；
- 同构密集数据 → 表格；
- 方案比较 → 共享维度比较表。

默认使用 `layout: "auto"`。只有确实需要固定结构时才覆盖布局。

## 浏览器质量门禁

`deliver` 默认检查：

- 1440×900，浅色；
- 1600×1000，浅色；
- 1920×1080，深色；
- 2048×1320，浅色；
- 390×844，手机窄屏。

自动诊断包括：

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

浏览器验收通过后才会原子替换最终 HTML。失败时保留原有产物，并保留失败候选和诊断回执供排查。

## 质量模式

- `standard`：阻止结构和真实渲染错误，保留质量告警；
- `showcase`：任何布局质量告警也会阻止最终交付。

推荐正式汇报始终使用：

```bash
--quality showcase
```

## 进一步阅读

- `references/authoring-contract.md`：Typed JSON 编写规范；
- `references/layout-contract.md`：自动布局与修复顺序；
- `references/delivery-contract.md`：浏览器验收、回执和原子交付；
- `schemas/report.schema.json`：完整字段定义。
