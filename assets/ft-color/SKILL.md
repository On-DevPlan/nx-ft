---
name: ft-color
description: nx-ft 里 **色彩资源（调色板集）** 的协作层：每个资源 = 一个调色板（Palette JSON，存于 data 槽位），CLI 增删改色卡 + 整组导出 CSS 变量 / JSON / Tailwind / TOML，配套共享的 19 条资源 CRUD + 编辑历史（每风格最近 5 条）。**面板端目前是标准资源域（管理页 + 单槽工作台）**——色盘 / 比例 / 笔刷三视图的全屏 Studio 由 ve 项目的 color-studio 复制进来后挂到 #/color/edit/<g>/<n>/full，UI 1:1 复刻。当用户要做调色板、批量加色、导出色卡成 CSS 变量 / Tailwind config、把调色板从代码 / 设计稿搬过来、或给了 #/color/... 面板链接要往里加东西时使用。触发词：色彩、调色板、palette、color palette、配色方案、design tokens、css 变量、tailwind config、导出色卡、添加颜色、新建调色板、color studio、色盘、color wheel、harmony、triadic、analogous、split-complementary、monochromatic。
---

# ft-color skill：色彩资源的协作层

这是 [`nx-ft`](../nx-ft/SKILL.md) 的**配套 skill**。nx-ft 负责存储与同源命令，ft-color 负责「调色板集」这一资源类型怎么增删改、怎么导出、怎么在面板里编辑。

> **每个 color 资源 = 一个调色板（Palette JSON）**，存于 `data` 槽位。多个调色板可以同属一个分组（组 = 调色板集）。
> 资源域是「分组 + 资源 + 风格 + 历史」四层结构，color 域沿用同一套（见 [[A00-序列总览]]）。

## 数据契约

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | 调色板展示名（如「主色板」「暗色模式」） |
| `harmony` | null \| { type, anchorColorId, autoFill } | 派生和声设置；type ∈ `triadic` \| `analogous` \| `split-complementary` \| `monochromatic`（v1：去掉了 complementary） |
| `colors` | ColorEntry[] | 色卡数组；每条 = `{id, hex, weight, locked, note, tags, createdAt, updatedAt, derivedFrom?}` |
| `sortBy` | `'manual' \| 'hue' \| 'brightness' \| 'saturation'` | 调色板内排序方式 |
| `createdAt` / `updatedAt` | number (ms) | 时间戳 |

> **派生色（derivedFrom）**：当 `harmony.autoFill = true` 时，色盘会按规则派生新色追加到 `colors`。每条派生色带 `derivedFrom: { paletteId, rule, slot }`——`(paletteId, slot)` 决定「槽位身份」，跨规则切换时**复用同一批槽位，只更新 hex/rule**（不新建条目）；槽位变少时多余的、未锁的条目会从池里清掉。这是和声互动的「继承关系」——切换三角 / 类似 / 分裂互补 / 单色时不会重复创建颜色。

完整字段约定与历史兼容性见 [[A02-数据契约]]。

## 序列总览

| 代号 | 类别 | 成员 | 回答 |
| --- | --- | --- | --- |
| **A** | 工作流与数据 | [[A00-序列总览]]（入口）→ [[A01-工作流]] / [[A02-数据契约]] | 怎么跑起来、CLI 速查、JSON 形状 |
| **B** | 场景案例 | [[B01-案例-主色板]] | 从 0 搭一个主色板并导出 Tailwind config |

## 60 秒上手

```bash
# 1. 建一个分组
nx-ft color group add demo --label 演示

# 2. 建调色板资源（--code-data 必填，--style 缺省为 default）
nx-ft color add demo primary --label 主色板 \
  --code-data '{"name":"主色板","harmony":null,"colors":[],"sortBy":"manual"}'

# 3. 加色
nx-ft color entry add demo primary "#5B7CFA" --note 主色 --tags brand,action
nx-ft color entry add demo primary "#845EF7" --note 辅助 --tags brand,accent
nx-ft color entry add demo primary "#15AABF" --note 链接 --tags link

# 4. 查
nx-ft color list demo
nx-ft color load demo primary

# 5. 导出
nx-ft color export demo --format css        # CSS 自定义属性
nx-ft color export demo --format json       # 原始 JSON
nx-ft color export demo --format tailwind   # tailwind.config.js
nx-ft color export demo --format toml       # 可被 importModal 解析回写

# 6. 改 / 删
nx-ft color put demo primary --code-data '{...整段 Palette JSON...}'   # 整段重写
nx-ft color entry rm demo primary "#5B7CFA"                          # 按 hex 删
nx-ft color history list demo primary default                          # 看历史（5 条）

# 7. 面板预览：nx-ft serve → http://localhost:7869 → 左侧「色彩资源」→ demo/primary
```

## 什么时候**不**触发本 skill

- **HTML / CSS / JS 资源**（按钮、组件、整页）→ 用 [`ft-html`](../ft-html/SKILL.md)
- **图标 / SVG 集**（一份一组图标、规范、画廊）→ 用 [`ft-svg`](../ft-svg/SKILL.md)
- **UI 视觉评估 / 配色评分**（不是把色卡当资源管理）→ 用 [`ft-uiux`](../ft-uiux/SKILL.md)

## 与其它 skill 的协作

- **`ft-uiux`** 评估 UI 配色时，会从 `color` 域读色板（约定：组名 `ui/<主题>`）。新建 UI 主题时先在 `color` 建好调色板，再到 UI 资源里 `@apply var(--brand)` 引用。
- **`ft-html` / `ft-svg`** 资源代码里想引用色板变量，用 `var(--主色板-1)` 这类 CSS 变量名（来自 `color export --format css` 的产物）。
- **`nx-ft` 主 skill** 负责存储与命令基础设施；调色板的「和声派生 / 取色器 / 笔刷 / 比例视图」等交互能力属于面板 UI（来自 ve 项目的 color-studio，目前尚未迁入 nx-ft——等复制进来后挂到 `/#/color/edit/<g>/<n>/full`）。
