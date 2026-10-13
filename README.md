# nx-ft

本机前端工程化资源管理工具：**HTML/SVG 渲染资源管理** + **SVG 图标集** + **脚本化 LOGO 生成**，CLI 与 Web 面板同源——一条 action 声明同时派生 CLI 命令与 HTTP 路由，面板上能做的，CLI 都能做。

## 它解决什么

- **100+ 本地 CSS 样式/组件风格管理**：分组（多层目录树）→ 资源（多标签检索）→ 风格（不限数量，多套实现对比）→ 编辑历史（每风格滚动 5 条，改坏可回退）
- **可视化验证**：CodePen 式三编辑框（HTML/SVG、CSS、JS）+ 实时预览 + 全屏展开
- **SVG 图标集**：一套可校验的规范（24pt 网格 / 线宽 1.8 / round 端点 / `currentColor`）——整库审计逐条给出「哪里不合规、为什么、怎么改」，一键归一化会**保比例**地换 `viewBox`（把内容包进 `<g transform>` 缩放，长宽比不一致则拒绝迁移），改动全部进编辑历史可回退
- **图标集的四层看板**：整库（含规范状态）→ 分组 → 单枚（多风格并排 + 规范问题 + CLI 命令块）→ 整页预览（尺寸阶梯 + 24pt 网格 + 明暗底色）；目录批量导入导出，导出附带一张自包含的 `index.html` 看板页
- **给旧项目补 LOGO**：零依赖脚本产出 SVG/PNG/ICO 全套 8 件，14 套撞色方案 + 自定义双色，`--out` 直写目标项目目录

## 快速开始

```bash
# 启动 Web 面板（默认 7869，浏览器自动打开）
npx nx-ft serve

# 开发期在仓库内：pnpm dev（vite 热更新 + serve 一条命令）
```

面板四个页签：首页（概览）、HTML 资源、SVG 资源、LOGO 生成。

## 常用命令

```bash
npx nx-ft routes                 # 全部命令 ↔ HTTP 路由对照（权威清单）
npx nx-ft help                   # 帮助

# 资源：建分组 → 建资源 → 写代码（多行走 heredoc + `-` 从 stdin 读）
npx nx-ft html group add ui/buttons --label 按钮
npx nx-ft html add ui/buttons login-btn --label 登录按钮 --style minimal --tags button,login
npx nx-ft html put ui/buttons login-btn --style minimal --code-html - <<'EOF'
<button class="btn">登录</button>
EOF

npx nx-ft html tree --tags button            # 标签筛选（多选 AND）
npx nx-ft html style add ui/buttons login-btn dark --copy-from minimal --desc 深色胶囊
npx nx-ft html history list ui/buttons login-btn dark   # 编辑历史（可 restore 回退）

# SVG 图标集：批量导入 → 规范自检 → 归一化 → 导出（svg 模块的命令与 html 同构，
# 下面是图标集专属的四条；`--code` 是 SVG 本体，对应 html 的 `--code-html`）
npx nx-ft svg import ui/icons --from ./icons/outline --label-from title --dry-run
npx nx-ft svg spec check                     # 逐条列出不合规的图标与原因
npx nx-ft svg spec fix --dry-run             # 先看改动清单，去掉 --dry-run 才写回
npx nx-ft svg export ui/icons --to ./out     # 目录 + 一张自包含 index.html 看板页
npx nx-ft svg cat ui/icons plus > plus.svg   # 读裸源码（改完再 put 回去）

# LOGO 生成（svg 模块同理，把 html 换成 svg）
npx nx-ft logo schemes
npx nx-ft logo gen xx --scheme ink --out D:/old-project/public   # 补旧项目
```

## 数据与存储

- 用户数据在 `~/.nx-ft/`（`assets/` 分组资源、`logos/` 生成画廊与历史登记）
- 环境变量 `NX_FT_DATA` 可整体覆盖（测试/隔离用）；`--store` 覆盖 store 路径
- 每个资源就是磁盘上的普通文本文件（`html`/`css`/`js`/`svg`），可直接手改、可 diff

## 给 AI Agent

随包分发 skill 手册（面板 `skill install` 或 CLI）：

```bash
npx nx-ft skill install nx-ft      # 装到 ~/.claude/skills
npx nx-ft skill install --group nx-ft          # 主 skill + ft-svg（图标集规范），一次装齐
npx nx-ft skill get nx-ft          # 导出 SKILL.md 全文
npx nx-ft skill get nx-ft 30-logo-generation   # 导出分篇参考
npx nx-ft skill get ft-svg         # 图标集：规范全文 / 关键线与光学对齐 / 看板与批量
```

## 开发

```bash
pnpm install
pnpm dev          # 一条命令起 dev（vite 7870 + serve 7869）
pnpm test         # lint + build + 冒烟 + 单元
```

架构三原则：action 一源两端（CLI/HTTP 不可能分叉）、依赖只能向下（`core ← modules ← runtime`，eslint 强制）、失败抛异常 / 业务结果返回 `{status}`。

MIT
