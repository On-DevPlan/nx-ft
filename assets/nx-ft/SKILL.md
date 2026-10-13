---
name: nx-ft
description: 本机前端工程化资源管理工具（npx nx-ft 形态）：HTML/SVG 渲染资源与可视化原件管理（100+ 本地样式/组件风格：标签检索、分组、多风格并存、编辑历史回滚），以及脚本化 LOGO 生成（SVG/PNG/ICO 全套、14 套撞色方案 + 自定义色，用于给旧项目补 LOGO）。当用户要求创建/编辑/预览 HTML 或 SVG 资源、按分组管理资源、给资源打标签、按标签筛选或搜索资源、为同一资源并存多种风格、查看或恢复编辑历史、生成/补 LOGO、挑配色方案、启动面板做可视化验证、或安装本 skill 给 agent 时使用。触发词：nx-ft、html 资源、svg 资源、渲染预览、分组资源、标签筛选、搜索资源、风格切换、编辑历史、LOGO 生成、补 LOGO、配色方案、favicon、启动面板、skill install。
---
# nx-ft skill

本项目是「CLI 与 Web 面板同源」的本机前端资源管理工具：一条 action 声明同时派生出
CLI 命令与 HTTP 路由，Web 上能做的，CLI 都能做。

**产品定位**：100+ 本地 CSS 样式 / 组件风格的资源库——用分组 + 标签 + 搜索
把资源找得回来，用多风格并存做对比验证，用编辑历史兜底回退。

- 项目根（安装时注入，固定值）：`{{PROJECT_ROOT}}`
- 数据目录：`~/.nx-ft/assets/`（可用环境变量 `NX_FT_DATA` 覆盖，测试用）

## 数据模型（先理解，再动手）

```
分组（目录树，1~8 段路径，如 ui/buttons/primary）
  └── 资源（一个场景，如「登录按钮」login-btn；带多个标签，如 #button #login）
        └── 风格（不限数量！如 minimal / dark / glass——同一场景的并存实现）
              └── 编辑历史（每次保存把「改动前」推入，每风格只保最近 5 条）
```

关键区分：
- **标签**回答「100+ 资源怎么找得回来」——资源级多标签，`tree --tags`（AND）
  与 `tree --search`（匹配 名称/展示名/分组路径/标签/风格名）是检索入口。
- **风格**回答「同一个场景我想并存几套实现做对比验证」——数量不限。
- **历史**回答「这套实现我改坏了要回退」——每个风格滚动保留最近 5 条快照，
  第 6 次保存会淘汰最旧的一条。

标签规则：归一化为小写、空白转 `-`；可用字母/数字/汉字/`-`/`_`/`.`；≤24 字符。

## 常用命令

在项目根目录执行（`<组>` 形如 `ui/buttons`）：

```bash
# 启动 Web 面板（默认端口 7869）
node bin/ft.mjs serve            # 开发期：pnpm dev

# 通用：查看全部命令 / 健康检查 / 安装本 skill
node bin/ft.mjs routes
node bin/ft.mjs health
node bin/ft.mjs skill install nx-ft

# 分组与资源（把 html 换成 svg 即操作 SVG 资源，命令完全同构）
node bin/ft.mjs html tree                                   # 全量
node bin/ft.mjs html tree --tags button,login               # 标签筛选（多选 AND）
node bin/ft.mjs html tree --search 登录                      # 关键词搜索
node bin/ft.mjs html group add ui/buttons --label 按钮
node bin/ft.mjs html add ui/buttons login-btn --label 登录按钮 --style minimal --tags button,login
node bin/ft.mjs html load ui/buttons login-btn          # 详情（默认含全部风格代码）
node bin/ft.mjs html rename ui/buttons login-btn --label 登录按钮V2
node bin/ft.mjs html rm ui/buttons login-btn --force

# 标签：资源级多标签，是 100+ 资源里的检索主轴
node bin/ft.mjs html tag add ui/buttons login-btn --tags dark,form
node bin/ft.mjs html tag rm ui/buttons login-btn --tags form

# 写代码：内容给 - 时从 stdin 读（多行内容必须走 heredoc，见下节）
node bin/ft.mjs html put ui/buttons login-btn --style minimal --code-html - <<'EOF'
<button class="btn" id="go">登录</button>
EOF
node bin/ft.mjs html put ui/buttons login-btn --style minimal --code-css '.btn{padding:10px 24px}'

# 风格（不限数量；--copy-from 从现有风格复制，--desc 一句话描述特征）
node bin/ft.mjs html style add ui/buttons login-btn dark --copy-from minimal --desc 深色渐变胶囊
node bin/ft.mjs html style switch ui/buttons login-btn dark
node bin/ft.mjs html style desc ui/buttons login-btn dark --text '主色紫，圆角 999px'
node bin/ft.mjs html style rm ui/buttons login-btn dark

# 编辑历史（每风格最近 5 条）
node bin/ft.mjs html history list ui/buttons login-btn minimal
node bin/ft.mjs html history read ui/buttons login-btn minimal --entry <id>
node bin/ft.mjs html history restore ui/buttons login-btn minimal --entry <id>

# LOGO 生成（给旧项目补 LOGO / 挑配色；详见 references/30-logo-generation.md）
node bin/ft.mjs logo schemes                          # 14 套撞色方案
node bin/ft.mjs logo preview xx --scheme ink          # SVG 源码（可重定向保存）
node bin/ft.mjs logo gen xx --scheme ink --out D:/old-project/public   # 全套 8 件直写目标目录
node bin/ft.mjs logo gen xy --bg #1E6FD9 --fg #FFFFFF # 自定义双色（对齐品牌色）
node bin/ft.mjs logo history                          # 最近生成记录（含目录）
```

SVG 资源示例：`node bin/ft.mjs svg add ui/icons arrow-up --style line --code '<svg .../>'`
（svg 模块的代码槽位是 `--code`（svg 本体）/`--code-css`/`--code-js`）。

加 `--json` 可获取机器可读输出（错误时同样输出 JSON）。

## 写多行代码：必须用 heredoc（实测踩坑）

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
7. 用户说「给某个旧项目补 LOGO」→ 问清字母与配色（或从旧项目 CSS 里取品牌色），
   `logo preview` 先给用户看，确认后 `logo gen --out <旧项目 public 目录>`；
   同名文件冲突时先问用户再 `--force`

## 约束

- 分组路径 1~8 段（支持多层目录树），段名不能含 `/`、`..`、不能以 `.` 开头；资源名/风格名同理
- 标签归一化为小写（空白转 `-`），可用字母/数字/汉字/`-`/`_`/`.`，≤24 字符；
  重复添加是幂等跳过（`skipped`），不是错误
- 删除非空分组/资源需要 `--force`（CLI 会先返回 `blocked` 让调用方决策）
- 命令、参数与 flag 的权威清单看 `routes --json`，不要凭记忆杜撰
- 面板是全屏可视化验证的主入口：**第一层**是分组管理页——左侧**多层目录树**
  （1~8 段路径，可展开/折叠、带资源计数），右侧当前目录的**面包屑** +
  子目录卡片 + 资源卡片，另有搜索框 + 标签云筛选；**第二层**是全屏工作台
  （左上角面包屑返回对应目录层级，右上角风格切换 / 新风格 / 描述 / 保存，
  主体三编辑框 + 实时预览，可全屏展开）。每次保存都会把改动前状态推入该风格的编辑历史
