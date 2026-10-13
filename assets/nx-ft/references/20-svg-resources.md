# 20 · SVG 资源：命令速查与协作要点

> 本文件是 `SKILL.md` 的配套速查。svg 与 html 共用同一套存储、分组、标签、
> 风格、编辑历史机制，命令**完全同构**（前缀换成 `svg`）。差异只有代码槽位：
> `--code`（SVG 本体，HTTP body 键为 `svg`）代替 `--code-html`。
> 标签与筛选语义见 `references/10-html-resources.md`「筛选与搜索语义」一节，
> svg 侧完全一致（`svg tree --tags icon,outline`、`svg tag add …`）。

## 命令全表（CLI ↔ HTTP 同源）

| 命令 | 用途 | 对应 HTTP |
| --- | --- | --- |
| `svg tree [--search <词>] [--tags a,b]` | 列出分组与资源（可按标签 AND / 关键词筛选） | `GET /api/svg/tree` |
| `svg group add <组> [--label]` | 建分组 | `POST /api/svg/groups` |
| `svg group rm <组> [--force]` | 删分组（非空需 --force） | `POST /api/svg/groups-remove` |
| `svg add <组> <名> [--label] [--style] [--tags a,b] [--code*]` | 新建资源 | `POST /api/svg/assets` |
| `svg load <组> <名> [--no-code]` | 资源详情 | `GET /api/svg/asset` |
| `svg put <组> <名> --style <风格> [--code*]` | 保存代码（改动前进历史） | `POST /api/svg/asset-code` |
| `svg rename <组> <名> --label <新>` | 改展示名 | `POST /api/svg/asset-rename` |
| `svg tag add <组> <名> --tags a,b` | 加标签（幂等） | `POST /api/svg/tags-add` |
| `svg tag rm <组> <名> --tags a,b` | 移除标签 | `POST /api/svg/tags-remove` |
| `svg rm <组> <名> [--force]` | 删资源 | `POST /api/svg/asset-remove` |
| `svg style add <组> <名> <风格> [--copy-from <现有风格>] [--desc <描述>]` | 新增风格（不限数量） | `POST /api/svg/styles` |
| `svg style switch <组> <名> <风格>` | 切换当前风格 | `POST /api/svg/style-active` |
| `svg style desc <组> <名> <风格> --text <描述>` | 设置风格描述（空串清除） | `POST /api/svg/style-desc` |
| `svg style rm <组> <名> <风格>` | 删风格（含历史） | `POST /api/svg/style-remove` |
| `svg history list <组> <名> <风格>` | 编辑历史（最近 5 条） | `GET /api/svg/history` |
| `svg history read … --entry <id>` | 读历史快照 | `GET /api/svg/history-entry` |
| `svg history restore … --entry <id>` | 恢复快照 | `POST /api/svg/history-restore` |

代码槽位 flag：`--code`（SVG 本体）、`--code-css`、`--code-js`。
HTTP body 短键：`{group, name, style, svg, css, js}`。

## 典型用法

```bash
# 建一个线性图标，再造一个填充风格做对比
node bin/ft.mjs svg group add ui/icons --label 图标
node bin/ft.mjs svg add ui/icons arrow-up --style line --code '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="96" height="96"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
node bin/ft.mjs svg style add ui/icons arrow-up filled --copy-from line
node bin/ft.mjs svg put ui/icons arrow-up --style filled --code '<svg viewBox="0 0 24 24" fill="currentColor" width="96"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
node bin/ft.mjs svg style switch ui/icons arrow-up filled
```

## 易错点

1. **多行 SVG 同样必须 heredoc + `-`**（`--code - <<'EOF'`），与 html 一致。
2. SVG 里的 `currentColor` 由 CSS 槽位驱动：`--code-css 'svg{color:#6366f1}'`
   即可换色，不必改 SVG 本体——做多风格配色时优先用这个。
3. 预览会自动把 SVG 居中并限制在视口内（`max-width:70vw`），
   写死巨大 width/height 也不影响预览形态。
4. 面板预览没有 `<body>` 概念——你的 SVG 直接作为页面的唯一元素渲染。

## 面板协作

`node bin/ft.mjs serve` 打开「SVG 资源」tab：交互与「HTML 资源」完全一致
（三编辑框为 SVG / CSS / JS，实时预览 + 全屏展开 + 风格切换）。
