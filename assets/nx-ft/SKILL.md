---
name: nx-ft
description: 当用户需要查阅本 ui-kit 提供的组件契约、tokens、风格包、SVG 资产、命令行用法，或请求生成 admin 页面/前端骨架时使用。触发词：ui-kit / 组件清单 / 风格包 / svg 资产 / studio manifest / spec → HTML。 不适用：业务逻辑实现、组件源码改动建议。
---

# nx-ft

一句话：多风格 UI 组件库（npm 包）+ agent-facing studio（GET /api/studio/manifest）。
一条 action 同时暴露 CLI、HTTP、面板——三者由 src/modules/studio/index.js 派生。

## 核心不变量（违反会怎样）

1. **spec 是单一真相源**——`src/components/<id>.spec.json` 改什么，catalog.json 就有什么。
   `nx-ft studio build` 重建 catalog，`tests/unit/manifest-consistency.test.mjs` 兜底。
2. **class 契约优于 React 组件**——`.btn` / `.card` 等类定义在 `src/styles/<pack>/*.css`，
   React binding 只是把 props 翻译成 className。删 .jsx 不影响组件可用性。
3. **三层样式纪律**——tokens（仅 `:root`）/ atomic strategies（仅 `.btn` 等类） / layout。
   tokens.css 不得出现选择器；策略 css 不得出现 `:root`；布局归 `src/layout/`。
4. **依赖只能向下**——`core ← modules ← runtime`；前端不能 import node: 内置模块。
   eslint + 一致性测试钉死。

## 命令速查（CLI ↔ HTTP 同源）

| 命令 | 说明 |
| --- | --- |
| `nx-ft serve [--port N] [--no-open]` | 启动 studio（Web 面板） |
| `nx-ft routes` | CLI ↔ HTTP 路由对照表 |
| `nx-ft help [topic]` | 帮助；`help --json` 输出可解析命令表 |
| `nx-ft health` | 自检：组件/风格包/命令表/存储都能解析 |
| `nx-ft studio manifest [--style paper]` | 整库目录（components + styles） |
| `nx-ft studio packs` | 已安装风格包清单 |
| `nx-ft studio component <id> [--style paper]` | 单件深读：spec + css + tokens |
| `nx-ft studio preview <id> [--style paper]` | 渲染组件 HTML（自包含片段） |
| `nx-ft studio build` | 从 spec 重建 catalog.json |
| `nx-ft studio doctor` | spec ↔ css ↔ catalog 一致性自检 |
| `nx-ft svg list` | SVG 资产组清单 |
| `nx-ft svg get <group>` | 单组详情：spec + items |
| `nx-ft svg preview <group> <item>` | 单件：SVG 原文 + 自包含 HTML 文档 |
| `nx-ft svg build` | 从 spec 重建 catalog（已包含在 `studio build` 链路里） |
| `nx-ft skill install [--force]` | 把用法装给本机 agent（~/.claude/skills） |
| `nx-ft skill get [ref]` | 导出 skill 上下文给外部 agent |
| 任何命令 + `--json` | 机器可读输出 |
| 任何命令 + `--store <path>` | 本次运行覆盖存储路径 |

## Agent 典型会话

1. `nx-ft routes --json` —— 拿到全部命令与路由，选需要的
2. `nx-ft studio manifest --style paper --json` —— 整库目录，按需用 `--style` 过滤 css
3. `nx-ft studio component <id> --style paper --json` —— 单件深读（含 spec + css）
4. `nx-ft studio preview <id> --style paper --json` —— 拿渲染好的 HTML 给用户看
5. 出错时读 `error` 字段：`NOT_FOUND` = 不存在；`INVALID_INPUT` = 参数问题。

## 离线通道：skill install

`nx-ft skill install` 把这份 SKILL.md 与 references/ 写到 `~/.claude/skills/<name>/`，
本机 agent 后续会话无需起服务就能拿到库的契约与用法。
