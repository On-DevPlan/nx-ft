---
name: ft-color
description: nx-ft 里 **色彩资源（调色板集）** 的协作层：每个资源 = 一个调色板（Palette JSON，存于 data 单槽），CLI 增删改色卡 + 整组导出 CSS 变量 / JSON / Tailwind / TOML，配套三域通用的 24 条资源 CRUD + 编辑历史（每风格最近 5 条）与 color 专属的 3 条（list / entry add / entry rm）。**面板端是标准资源域（管理页 + 单槽工作台），另有全屏 Studio**（色盘 / 比例 / 笔刷三视图 + 导入导出弹窗），已挂在 `#/color/edit/<组>/<名>/full`。当用户要做调色板、批量加色、导出色卡成 CSS 变量 / Tailwind config、把调色板从代码 / 设计稿搬过来、或给了 #/color/... 面板链接要往里加东西时使用。触发词：色彩、调色板、palette、color palette、配色方案、design tokens、css 变量、tailwind config、导出色卡、添加颜色、新建调色板、color studio、色盘、color wheel、harmony、triadic、analogous、split-complementary、monochromatic。
---

# ft-color skill：色彩资源的协作层

这是 [`nx-ft`](../nx-ft/SKILL.md) 的**配套 skill**。nx-ft 负责存储与同源命令，ft-color 负责「调色板集」这一资源类型怎么增删改、怎么导出、怎么在面板里编辑。

> **每个 color 资源 = 一个调色板（Palette JSON）**，存于 `data` 槽位。多个调色板可以同属一个分组（组 = 调色板集）。
> 资源域是「分组 + 资源 + 风格 + 历史」四层结构，color 域沿用同一套（见 [[A00-序列总览]]）。

> **命令形态**：本文用 `nx-ft color …`——全局装了 nx-ft 就能用，没装就 `npx nx-ft color …`。
> 在 nx-ft 仓库根目录里工作的话，等价写法是 `node bin/ft.mjs color …`。

## 它和 html / svg 域的关系（先对齐口径，再动手）

三域**共用同一份存储模型与 24 条通用命令**（分组 / 资源 / 风格 / 历史 / 标签 / 排序 / reveal），
`color` 只是**槽位不同**：

| 域 | 槽位 | 一个资源是什么 | 内容形状 |
| --- | --- | --- | --- |
| `html` | `html` / `css` / `js` | 一个场景 | 源码三件套 |
| `svg` | `svg` / `css` / `js` | 一枚图形 | SVG 源码 + 样式 |
| `color` | **`data`（单槽）** | 一个调色板 | 一整段 Palette JSON |

color 专属只有 3 条：`list`（列组内调色板与色卡）、`entry add` / `entry rm`（按色卡粒度增删）。

**两个最容易踩的跨域差异**：

- `export` 三域同名不同义：html/svg 导出成**目录树**，color 导出成**一份文本**
  （`--format css|json|tailwind|toml`）。color 域**没有** `import`——
  想把外部配色搬进来，走 `put --code-data`（或面板导入弹窗）。
- 改内容只有一条路：`put --code-data`（整段重写 Palette JSON）或 `entry add/rm`（按色卡粒度）。
  **不要**直接改磁盘上的 data 文件——那绕过编辑历史，出错回不去。

## 数据契约

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | 调色板展示名（如「主色板」「暗色模式」） |
| `harmony` | null \| { type, anchorColorId, autoFill } | 派生和声设置；type ∈ `triadic` \| `analogous` \| `split-complementary` \| `monochromatic`（v1：去掉了 complementary） |
| `colors` | ColorEntry[] | 色卡数组；每条 = `{id, hex, weight, locked, note, tags, createdAt, updatedAt, derivedFrom?}` |
| `sortBy` | `'manual' \| 'hue' \| 'brightness' \| 'saturation'` | 调色板内排序方式 |
| `createdAt` / `updatedAt` | number (ms) | 时间戳 |

> **派生色（derivedFrom）**：当 `harmony.autoFill = true` 时，色盘会按规则派生新色追加到 `colors`。每条派生色带 `derivedFrom: { paletteId, rule, slot }`——`(paletteId, slot)` 决定「槽位身份」，跨规则切换时**复用同一批槽位，只更新 hex/rule**（不新建条目）；槽位变少时多余的、未锁的条目会从池里清掉。这是和声互动的「继承关系」——切换三角 / 类似 / 分裂互补 / 单色时不会重复创建颜色。
>
> **锚色（anchorColorId）就是当前选中的色卡**——它随选中色移动，派生色恒为 f(锚色, 规则)。
> 勾上 `autoFill` 后，拖色轮改锚色会实时重算派生色。

完整字段约定与历史兼容性见 [[A02-数据契约]]。

## 面板 URL：用户贴链接时先解码出意图

| URL | 含义 |
| --- | --- |
| `#/color` | 资源网盘（分组 + 卡片） |
| `#/color/dir/<组路径>` | 定位到指定组（与 html/svg 一致的网盘布局） |
| `#/color/edit/<组>/<调色板>` | 工作台（DATA 单槽编辑 + swatch 预览；改后保存入历史） |
| `#/color/edit/<组>/<调色板>/full` | **全屏 Studio**（色盘 / 比例 / 笔刷三视图 + 导入/导出/案例弹窗） |

段是 percent-encoded，**先解码**再用。落在 `dir` 上 = 往这个文件夹放东西；
落在 `edit` 上 = 改这一个具体调色板；多一段 `full` = 进全屏 Studio。
更多解析规则见 [[A00-序列总览]]。

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
nx-ft color entry rm demo primary --hex "#5B7CFA"                     # 按 hex 删（也可 --id）
nx-ft color history list demo primary default                         # 看历史（5 条）

# 7. 面板预览：nx-ft serve → http://localhost:7869 → 左侧「色彩资源」→ demo/primary
```

> `color entry rm` 的 hex 是 **flag**（`--hex`）或色卡 id（`--id`），**不是位置参数**——
> 写成 `color entry rm demo primary "#5B7CFA"` 会被 CLI 拒了（「多余的参数」）。
> 同理 `color history list` 的**风格是必填**位置参数（缺省值不存在）。

## 什么时候**不**触发本 skill

- **HTML / CSS / JS 资源**（按钮、组件、整页）→ 用 [`ft-html`](../ft-html/SKILL.md)
- **图标 / SVG 集**（一份一组图标、规范、画廊）→ 用 [`ft-svg`](../ft-svg/SKILL.md)
- **LOGO 生成**（给旧项目补 LOGO、挑撞色方案）→ 那是 `nx-ft logo …`，见 [`nx-ft`](../nx-ft/SKILL.md)
- **UI 视觉评估 / 配色评分**（不是把色卡当资源管理）→ 那是仓库里的评估工具，不随包分发

## 与其它 skill 的协作

- **`ft-html` / `ft-svg`** 资源代码里想引用色板变量，用 `var(--主色板-1)` 这类 CSS 变量名（来自 `color export --format css` 的产物）。
- **`nx-ft` 主 skill** 负责存储与命令基础设施（三域通用的 24 条命令、URL 词汇、面板结构）——
  本文件只讲 color 域自己的事：Palette JSON 形状、和声派生、导出格式。
- **调色板 → UI 主题**的常见动线：先在 `color` 域建好调色板（组名约定 `ui/<主题>`），
  再到 `html` / `svg` 域的资源里引用导出的 CSS 变量。
