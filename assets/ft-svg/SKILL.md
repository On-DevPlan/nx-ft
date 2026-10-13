---
name: ft-svg
description: 本机 SVG 图标集的**规范与协作层**：定义 24pt 线性图标的统一标准（网格 / 线宽 / 取色 / 端点），提供批量导入导出、规范审计与一键归一化、以及「AI 用 CLI 读—改—写回」的闭环。当用户要求画/生成图标、做图标集、统一图标风格、让一组 SVG 看起来一致、导入一整个图标目录、导出图标集、检查 SVG 是否规范、修复不规范的 SVG、或用 CLI 批量改图标时使用。触发词：图标集、icon set、图标规范、画图标、生成图标、统一图标、图标不一致、批量导入 svg、导出图标、svg 审计、svg 规范检查、svg 归一化、图标网格、24pt 图标。
---

# ft-svg skill：一致的 SVG 图标集

这是 [`nx-ft`](../nx-ft/SKILL.md) 的**配套 skill**。nx-ft 负责存储与同源命令，
ft-svg 负责图标这件事本身的**标准**：

> 图标集看起来「齐不齐」，从来不是每一枚画得好不好，
> 而是它们**是否共享同一套网格、线宽、端点和取色方式**。
> 这三样一旦分叉，单看每枚都漂亮，摆在一起就是散的。

所以本 skill 只保证三件事，其余交给 nx-ft 的存储机制：

| 保证 | 判据 | 谁来管 |
| --- | --- | --- |
| 一套坐标 | `viewBox="0 0 24 24"`，不写死 `width`/`height` | `svg spec check` / `spec fix` |
| 一套线条 | `stroke-width="1.8"` + `linecap/linejoin="round"` | 同上 |
| 一种取色 | 一律 `currentColor`，颜色由外层 CSS 驱动 | 同上 |

三者都满足时，同一个 `.svg` 放在浅色面板、深色底、按钮里都会自动正确——
不需要为每种场景再导一份。

## 60 秒：合规骨架

照抄这个形状，只改 `<title>` 与 `d`：

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <title>加号</title>
  <path d="M12 5v14M5 12h14"/>
</svg>
```

- `<title>` 不是装饰：批量导入时用 `--label-from title` 直接取它做展示名。
- 没有 `width`/`height` 是**故意的**——尺寸该由使用方决定，写死就锁死了复用。
- 图形内容画在 `x∈[3.5, 20.5]` 的 17pt 活动区内（四周留 3.5pt 呼吸位）。
  细则与关键形状尺寸见 [references/10-icon-spec.md](references/10-icon-spec.md)。

## 命令速查（CLI ↔ HTTP 同源）

在项目根目录执行；`<组>` 形如 `ui/icons`，`<名>` 是目录名（kebab-case）。

```bash
# 看板数据 / 单枚详情（含全部风格与规范审计）
node bin/ft.mjs svg board
node bin/ft.mjs svg detail ui/icons plus

# 读源码（裸输出，可管道）—— agent 编辑的读端
node bin/ft.mjs svg cat ui/icons plus --style default --slot svg > plus.svg

# 写回（stdin）—— agent 编辑的写端；改动前状态自动进编辑历史
node bin/ft.mjs svg put ui/icons plus --style default --code - <<'EOF'
<svg …>…</svg>
EOF

# 批量导入一整个目录（先在 dry-run 里看计划）
node bin/ft.mjs svg import ui/icons --from ./icons/outline --label-from title --dry-run
node bin/ft.mjs svg import ui/icons --from ./icons/outline --label-from title --tags outline

# 批量导出（目录 + 一张自包含 index.html 看板页）
node bin/ft.mjs svg export ui/icons --to ./out/icons

# 规范审计 / 一键归一化（不传分组 = 整库）
node bin/ft.mjs svg spec show
node bin/ft.mjs svg spec check ui/icons
node bin/ft.mjs svg spec fix ui/icons --dry-run
node bin/ft.mjs svg spec fix ui/icons
```

命令、参数与 flag 的权威清单看 `node bin/ft.mjs routes --json`，不要凭记忆杜撰。
加 `--json` 得机器可读输出。

## 写多行 SVG：必须 heredoc（实测踩坑）

多行内容当命令行参数传，跨 exec 边界会被 shell 切成只剩第一行，后面的 flag 静默丢失。

```bash
node bin/ft.mjs svg put ui/icons plus --style default --code - <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 5v14M5 12h14"/>
</svg>
EOF
```

四要素，缺一不可：
1. `-` 占位（内容从 stdin 读）
2. **所有 flag 都在 `<<'EOF'` 之前**（写后面会被当成下一条命令，无报错）
3. 定界符**带引号**（不带会展开 `$`、执行反引号）
4. `EOF` **顶格**（前面有空格会吞掉后续文本）

## AI 编辑一枚图标的标准闭环

```
svg cat  →  改路径  →  svg put  →  svg spec check  →  （必要时）svg spec fix
```

每一步都在面板上看得见：`svg cat` 读到的就是资源页编辑框里的内容，
`svg put` 之后看板角标与「编辑历史」立刻更新。改动**永远走 `put`**——
`put` 会把改动前状态推进该风格的编辑历史，所以 agent 改错了，
用户能用 `svg history restore --entry <id>` 逐条退回。
**不要绕过 CLI 直接改 `~/.nx-ft/assets/` 下的文件**：那样会跳过历史与分组清单，
面板看到的还是旧内容。

## 典型会话

1. 「把这批 48 个图标导入进来」→ `svg import <组> --from <目录> --label-from title --dry-run`
   → 核对计划 → 去掉 `--dry-run` → `svg board` 复核
2. 「这几个图标看起来不齐」→ `svg spec check <组>` 看每条原因
   → `svg spec fix <组> --dry-run` 看改动 → 确认后去掉 `--dry-run`
3. 「再加一个搜索图标，跟现有的一致」→ `svg spec show` 取骨架 →
   `svg put <组> search --style default --code - <<'EOF' …` → `svg spec check <组>`
4. 「同一个图标我想留两种画法做对比」→ `svg style add <组> <名> alt --copy-from default`
   → `svg put … --style alt` → 面板资源页并排看
5. 「改坏了」→ `svg history list <组> <名> default` → `svg history restore … --entry <id>`

## 参考文档

- [references/10-icon-spec.md](references/10-icon-spec.md) —— 规范全文、关键形状尺寸、违规对照表、`normalizeSvg` 到底改了什么
- [references/20-icon-set-method.md](references/20-icon-set-method.md) —— 画一组「看起来齐」的图标：网格与关键线、光学对齐、笔画词汇、命名与分组
- [references/30-board-and-batch.md](references/30-board-and-batch.md) —— 看板读法、路由、批量导入导出、审计与归一化、失败模式排查

## 约束

- 分组路径 1~3 段；段名 / 资源名 / 风格名都不能含 `/`、`..`，不能以 `.` 开头
- 资源名即目录名，用 kebab-case；展示名走 `--label` 或 `<title>`
- 删除非空分组 / 资源需要 `--force`（CLI 会先返回 `blocked` 让调用方决策）
- 「合规」不等于「好看」：`spec check` 只保证三者一致，不评判造型
