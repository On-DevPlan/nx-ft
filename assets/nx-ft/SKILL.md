---
name: nx-ft
description: 本机前端工程化资源管理工具（npx nx-ft 形态）：**HTML / SVG / 色彩三个资源域**的渲染资源与可视化原件管理（100+ 本地样式/组件风格：标签检索、分组、多风格并存、编辑历史回滚），以及脚本化 LOGO 生成（SVG/PNG/ICO 全套、14 套撞色方案 + 自定义色，用于给旧项目补 LOGO）。当用户要求创建/编辑/预览 HTML、SVG 或调色板资源、按分组管理资源、给资源打标签、按标签筛选或搜索资源、为同一资源并存多种风格、查看或恢复编辑历史、生成/补 LOGO、挑配色方案、启动面板做可视化验证、或安装本 skill 给 agent 时使用。触发词：nx-ft、html 资源、svg 资源、色彩资源、调色板、palette、配色方案、design tokens、渲染预览、分组资源、标签筛选、搜索资源、风格切换、编辑历史、LOGO 生成、补 LOGO、配色方案、favicon、启动面板、skill install。
---

# nx-ft skill

本项目是「CLI 与 Web 面板同源」的本机前端资源管理工具：一条 action 声明同时派生出
CLI 命令与 HTTP 路由，Web 上能做的，CLI 都能做。

**产品定位**：100+ 本地 CSS 样式 / 组件风格的资源库——用分组 + 标签 + 搜索
把资源找得回来，用多风格并存做对比验证，用编辑历史兜底回退。

- 项目根（安装时注入，固定值）：`{{PROJECT_ROOT}}`
- 数据目录：`~/.nx-ft/assets/`（可用环境变量 `NX_FT_DATA` 覆盖，测试用）
- **三个资源域**：`html` / `svg` / `color`（+ 一个不是资源域的 `logo`）

## 三个域：一份存储模型 + 一张槽位表

```
分组（目录树，1~8 段路径，如 ui/buttons/primary）
  └── 资源（一个场景，如「登录按钮」login-btn；带多个标签，如 #button #login）
        └── 风格（不限数量！如 minimal / dark / glass——同一场景的并存实现）
              └── 编辑历史（每次保存把「改动前」推入，每风格只保最近 5 条）
```

**三域共用上面这套四层结构**（同一份存储、同一套分组/风格/历史逻辑）。
换域只换**一张槽位表**——面板编辑框的槽位与数据形状：

| 域 | 一个资源是什么 | 槽位（= 编辑框） | 数据形状 |
| --- | --- | --- | --- |
| `html` | 一个场景（登录按钮 / 整页） | `html` / `css` / `js` | 源码三件套 |
| `svg` | 一枚图标 / 一个图形 | `svg` / `css` / `js` | SVG 源码 + 样式 |
| `color` | 一个调色板（Palette） | `data`（**单槽**） | 一段 Palette JSON |

> 槽位表是代码里的唯一事实源（`ASSET_KINDS`）。**要确认某域有哪些槽位、对应哪个
> `--code-*` flag，看 `nx-ft routes --json` 的 usage 串，别凭记忆。**

关键区分（与域无关）：
- **标签**回答「100+ 资源怎么找得回来」——资源级多标签，`tree --tags`（AND）
  与 `tree --search`（匹配 名称/展示名/分组路径/标签/风格名）是检索入口。
- **风格**回答「同一个场景我想并存几套实现做对比验证」——数量不限。
- **历史**回答「这套实现我改坏了要回退」——每个风格滚动保留最近 5 条快照，
  第 6 次保存会淘汰最旧的一条。

标签规则：归一化为小写、空白转 `-`；可用字母/数字/汉字/`-`/`_`/`.`；≤24 字符。

## 三个域各配一份协作 skill

| 域 | 配套 skill | 什么时候读它 |
| --- | --- | --- |
| `html` | [`ft-html`](../ft-html/SKILL.md) | 写一个场景、并存多套风格、预览壳怎么拼 |
| `svg` | [`ft-svg`](../ft-svg/SKILL.md) | 画图标/成套图标、档位与规范审计、画廊视图 |
| `color` | [`ft-color`](../ft-color/SKILL.md) | 调色板 JSON 形状、和声派生、4 种导出格式 |

`skill install --group nx-ft` 一次装齐（主 skill + 三份域 skill）。
本文件只讲**三域共通**的存储模型与命令面；**域内的细节**去对应那份 skill。
（域 skill 里的命令用全局形态 `nx-ft <域> …`；在本项目根目录内等价写法是
`node bin/ft.mjs <域> …`。）

### 主 skill 自带的速查 ref

| ref | 什么时候读 |
| --- | --- |
| [`10-html-resources.md`](references/10-html-resources.md) | html 域的 CLI ↔ HTTP 逐条对照、槽位 flag、检索语义 |
| [`20-svg-resources.md`](references/20-svg-resources.md) | svg 域的同构命令 + 专属命令（看板 / 批量 / 规范审计） |
| [`25-color-resources.md`](references/25-color-resources.md) | color 域的同构命令 + 专属命令（list / entry）+ **export 三域语义差异** |
| [`30-logo-generation.md`](references/30-logo-generation.md) | LOGO 生成（不是资源域，单独一套） |

## 用户贴了一个面板 URL 时怎么读

面板路由是**三个资源域共用**的一套词汇（只换首段）：

| URL | 含义 |
| --- | --- |
| `#/<域>` | 该域的根目录 |
| `#/<域>/dir/<组路径>` | 某个**文件夹**（组路径 1~8 段） |
| `#/<域>/edit/<组路径>/<资源名>` | 某个**资源的编辑页** |

`<域>` 是 `html` / `svg` / `color`；段是 percent-encoded，**先解码**再用。
`color` 域多一条：**`#/color/edit/<组路径>/<资源名>/full`** = 全屏 Studio
（色盘 / 比例 / 笔刷三视图 + 导入导出弹窗）。

口诀：**落在 `dir` 上 = 往这个文件夹放东西；落在 `edit` 上 = 改这一个具体资源。**

例：用户说「给 `http://127.0.0.1:7869/#/svg/dir/%E6%B5%8B%E8%AF%95` 添加资源」→
读出「**svg** 域、分组 **测试**、要**新建资源**」，直接执行
`nx-ft svg add 测试 <名> --style default`，不必反问是哪个分组。

细节见 [`ft-html`](../ft-html/references/A01-工作流.md) 与 [`ft-svg`](../ft-svg/references/A01-工作流.md) 的工作流 ref。

## 常用命令

在项目根目录执行（`<组>` 形如 `ui/buttons`）：

```bash
# 启动 Web 面板（默认端口 7869）
node bin/ft.mjs serve            # 开发期：pnpm dev

# 通用：查看全部命令 / 健康检查 / 安装本 skill
node bin/ft.mjs routes
node bin/ft.mjs health
node bin/ft.mjs skill install nx-ft
```

### 三域通用：24 条命令，换个域名前缀就是另一个域

```bash
# 看全库 / 检索（--tags 多选 AND，--search 关键词）
nx-ft html tree                                   # 全量
nx-ft html tree --tags button,login               # 标签筛选
nx-ft html tree --search 登录                      # 关键词搜索

# 分组
nx-ft html group add ui/buttons --label 按钮
nx-ft html group rename ui/buttons --to ui/cta --label CTA  # 改路径或只改展示名
nx-ft html group rm ui/buttons --force             # 非空需 --force
nx-ft html group reorder --order ui,a,b            # 同级顺序（--order 给全量新顺序）

# 资源
nx-ft html add ui/buttons login-btn --label 登录按钮 --style minimal --tags button,login
nx-ft html load ui/buttons login-btn               # 详情（含风格与历史清单）
nx-ft html rename ui/buttons login-btn --label 登录按钮V2   # --to 改目录名
nx-ft html move ui/buttons login-btn --to ui/forms  # 搬资源（风格与历史跟着走）
nx-ft html rm ui/buttons login-btn --force
nx-ft html asset reorder --group ui/buttons --order a,b     # 同组资源顺序
nx-ft html desc ui/buttons login-btn --text "登录按钮"      # 资源级主描述
nx-ft html reveal ui/buttons                        # 在文件管理器里打开该目录

# 标签
nx-ft html tag add ui/buttons login-btn --tags dark,form
nx-ft html tag rm  ui/buttons login-btn --tags form

# 风格（不限数量）
nx-ft html style add ui/buttons login-btn dark --copy-from minimal --desc 深色渐变胶囊
nx-ft html style switch ui/buttons login-btn dark
nx-ft html style desc  ui/buttons login-btn dark --text '主色紫，圆角 999px'
nx-ft html style rm    ui/buttons login-btn dark

# 编辑历史（每风格最近 5 条）
nx-ft html history list ui/buttons login-btn minimal
nx-ft html history read ui/buttons login-btn minimal --entry <id>
nx-ft html history restore ui/buttons login-btn minimal --entry <id>
```

### 各域专属命令

| 域 | 专属命令 | 干什么 |
| --- | --- | --- |
| `html` | `import` | 批量导入：目录或 `.zip` → 资源目录（`--dry-run` 先看计划） |
| `svg` | `board` / `detail` / `cat` | 整库看板 / 全风格详情 / 打印裸源码（管道编辑用） |
| `svg` | `import` | 批量导入：目录或 `.zip` 里的 `.svg` → 资源 |
| `svg` | `spec show` / `spec check` / `spec fix` | 图标规范打印 / 逐条审计 / 批量归一化（改动进历史） |
| `color` | `list` | 列出组内所有调色板与色卡（含派生来源标记） |
| `color` | `entry add` / `entry rm` | 追加一色 / 删一色（`--hex` 或 `--id` 指定） |

### ⚠️ `export` 三域同名不同义（最容易踩）

| 域 | `export` 产出 | 有 `import` 吗 |
| --- | --- | --- |
| `html` | **目录**：`<组>/<资源>/{index.html,style.css,script.js}` | 有（目录 / zip） |
| `svg` | **目录**：`<组>/<资源>/{*.svg,index.html 看板页}` | 有（目录 / zip） |
| `color` | **文本**：`--format css\|json\|tailwind\|toml`（整组调色板） | **没有**——回写用 `put --code-data` |

想让别的域也按 `color` 的语义导出，不可能——它是「一组资源 → 一份配置」，
而 html/svg 的 export 是「一组资源 → 一棵目录树」。

### color 域 60 秒上手

```bash
# 1. 建组（组 = 调色板集）
nx-ft color group add brand --label 品牌色

# 2. 建调色板（--code-data 必填；--style 缺省 default）
nx-ft color add brand primary --label 主色板 --code-data '{"name":"主色板","harmony":null,"colors":[],"sortBy":"manual"}'

# 3. 加色（比整段重写 Palette JSON 省事得多）
nx-ft color entry add brand primary "#5B7CFA" --note 主色 --tags brand,action
nx-ft color entry add brand primary "#845EF7" --note 辅助 --tags brand,accent

# 4. 看
nx-ft color list brand                    # 组内所有调色板与色卡
nx-ft color load brand primary            # 单个详情

# 5. 导出（整组，四种格式）
nx-ft color export brand --format css         # CSS 自定义属性
nx-ft color export brand --format json        # 原始 JSON
nx-ft color export brand --format tailwind    # tailwind.config.js
nx-ft color export brand --format toml        # 可被面板导入弹窗解析回写

# 6. 改 / 删
nx-ft color put brand primary --code-data '<整段 Palette JSON>'   # 整段重写
nx-ft color entry rm brand primary --hex "#5B7CFA"               # 删一色（--hex 或 --id）
nx-ft color history list brand primary default                   # 历史（5 条）
```

> `color` 域的槽位是**单槽 `data`**：内容是一整段 Palette JSON
> （`name` / `harmony` / `colors[]` / `sortBy`），形状见 [`ft-color`](../ft-color/references/A02-数据契约.md)。
> **多行 JSON 必须走 heredoc**（见下节）。

### 写代码：内容给 `-` 时从 stdin 读（多行内容必须走 heredoc，见下节）

```bash
node bin/ft.mjs html put ui/buttons login-btn --style minimal --code-html - <<'EOF'
<button class="btn" id="go">登录</button>
EOF
node bin/ft.mjs html put ui/buttons login-btn --style minimal --code-css '.btn{padding:10px 24px}'
```

### LOGO 生成（给旧项目补 LOGO / 挑配色；详见 references/30-logo-generation.md）

```bash
node bin/ft.mjs logo schemes                          # 14 套撞色方案
node bin/ft.mjs logo preview xx --scheme ink          # SVG 源码（可重定向保存）
node bin/ft.mjs logo gen xx --scheme ink --out D:/old-project/public   # 全套 8 件直写目标目录
node bin/ft.mjs logo gen xy --bg #1E6FD9 --fg #FFFFFF # 自定义双色（对齐品牌色）
node bin/ft.mjs logo history                          # 最近生成记录（含目录）
```

端口被占时 `serve` 会先认领：端口上已经是本项目的面板 → 直接打开它（不重复启动）；被别的服务占了 → 顺延到下一个空闲端口再开自己的面板。`--no-open` 只关这一次；设 `NX_SERVE_NO_OPEN=1` 则全局不开浏览器（所有 nx-xx 项目通用）。

SVG 资源示例：`nx-ft svg add ui/icons arrow-up --style line --code '<svg .../>'`
（svg 模块的代码槽位是 `--code`（svg 本体）/`--code-css`/`--code-js`）。

加 `--json` 可获取机器可读输出（错误时同样输出 JSON）。

## 写多行内容：必须用 heredoc（实测踩坑）

多行内容**绝不当命令行参数直接传**——跨 exec 边界会被 shell 切成只剩第一行，
后面的 flag 静默丢失。**成功模板**（照抄这个形状）：

```bash
node bin/ft.mjs html put ui/buttons login-btn --style minimal --code-html - <<'EOF'
<button class="btn">
  登录
  <span>多行内容</span>
</button>
EOF
```

四要素：`-` 占位、flag 全在 `<<'EOF'` 之前、定界符带引号、`EOF` 顶格。
- 定界符**不带引号**会展开 `$`、执行反引号命令——必须 `<<'EOF'`。
- flag 写在 heredoc 之后会被 shell 当独立命令执行——**静默丢失**，无报错。
- `EOF` 前有空格会吞掉后续命令文本——必须顶格。

（`color` 域的 `--code-data` 同理：多行 Palette JSON 走 `--code-data -` + heredoc。）

## 典型会话（AI 工作流）

1. 用户说「做个登录按钮，几种风格对比」→
   `group add ui/buttons` → `add ui/buttons login-btn --style minimal --tags button,login` →
   `put --code-html - <<'EOF' …` → `style add … dark --copy-from minimal` →
   `put --style dark --code-css '…'` → 面板 `serve` 里可视化对比
2. 用户说「找出所有按钮类资源」→ `tree --tags button`（多标签继续收窄：`--tags button,login`）
3. 用户说「搜一下登录相关的」→ `tree --search 登录`（命中 名称/展示名/分组/标签/风格名）
4. 用户说「把那个按钮换个配色」→ `style add`（新风格）或 `put`（改现有风格，
   改动前状态自动进历史可回退）
5. 用户说「刚才改坏了」→ `history list` → `history restore --entry <id>`
6. 用户要「验证效果」→ `serve`，在面板里用搜索框/标签云筛选、切风格、全屏预览对比
7. 用户说「建一套品牌色」→ `color group add brand` → `color add brand primary --code-data …` →
   `color entry add …` 逐色加 → `color export brand --format tailwind` 给前端工程用
8. 用户说「给某个旧项目补 LOGO」→ 问清字母与配色（或从旧项目 CSS 里取品牌色），
   `logo preview` 先给用户看，确认后 `logo gen --out <旧项目 public 目录>`；
   同名文件冲突时先问用户再 `--force`

## 约束

- 分组路径 1~8 段（支持多层目录树），段名不能含 `/`、`..`、不能以 `.` 开头；资源名/风格名同理
- 标签归一化为小写（空白转 `-`），可用字母/数字/汉字/`-`/`_`/`.`，≤24 字符；
  重复添加是幂等跳过（`skipped`），不是错误
- 删除非空分组/资源需要 `--force`（CLI 会先返回 `blocked` 让调用方决策）
- 命令、参数与 flag 的权威清单看 `routes --json`，不要凭记忆杜撰
- **面板是全屏可视化验证的主入口，三个 tab 是同一套网盘布局**：面包屑当地址栏
  （点段回跳）、当前目录的文件卡片（点子目录下行）、**内联新建**（只起名，回车即建，
  不弹表单）、搜索 + 标签云筛选。没有左侧常驻目录树——层级靠钻取与地址栏。
  **HTML 资源** tab 在工作台里是「三编辑框（HTML/CSS/JS）横向并排 + 预览在下方」，
  中间可拖拽调比例。**SVG 资源** tab 多两个视图：**编辑**（卡片列表）与
  **画廊**（资源平铺成墙 + 主题色范围切换 + 尺寸 + 单色/双色筛选），
  另有看板动作（批量导入 / 导出 / 规范自检 / 一键归一化）。
  **色彩资源** tab 是「单槽 DATA 编辑 + swatch 预览」，并多一条全屏入口
  `#/color/edit/<组>/<名>/full`（色盘 / 比例 / 笔刷三视图的全屏 Studio）。
  三个 tab 共用同一套 URL 词汇（`#/<域>`、`#/<域>/dir/<组>`、`#/<域>/edit/<组>/<名>`）。
  每次保存都会把改动前状态推入该风格的编辑历史
