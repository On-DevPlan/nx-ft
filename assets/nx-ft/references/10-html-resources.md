# 10 · HTML 资源：命令速查与协作要点

> 本文件是 `SKILL.md` 的配套速查。**先读 SKILL.md 的数据模型一节**，
> 这里只列 html 模块的命令与易错点。svg 模块命令完全同构（把 `html` 换成 `svg`）。

## 命令全表（CLI ↔ HTTP 同源）

| 命令 | 用途 | 对应 HTTP |
| --- | --- | --- |
| `html tree [--search <词>] [--tags a,b]` | 列出分组与资源（可按标签 AND / 关键词筛选） | `GET /api/html/tree` |
| `html group add <组> [--label]` | 建分组（1~8 段路径，支持多层） | `POST /api/html/groups` |
| `html group rm <组> [--force]` | 删分组（非空需 --force） | `POST /api/html/groups-remove` |
| `html add <组> <名> [--label] [--style] [--tags a,b] [--code-*]` | 新建资源，可带首个风格与标签 | `POST /api/html/assets` |
| `html load <组> <名> [--no-code]` | 资源详情（标签 + 风格清单 + 全部代码） | `GET /api/html/asset` |
| `html put <组> <名> --style <风格> [--code-*]` | 保存代码（改动前自动进历史） | `POST /api/html/asset-code` |
| `html rename <组> <名> --label <新>` | 改展示名（目录名不变） | `POST /api/html/asset-rename` |
| `html tag add <组> <名> --tags a,b` | 加标签（幂等；已存在则 skipped） | `POST /api/html/tags-add` |
| `html tag rm <组> <名> --tags a,b` | 移除标签 | `POST /api/html/tags-remove` |
| `html rm <组> <名> [--force]` | 删资源（含风格需 --force） | `POST /api/html/asset-remove` |
| `html style add <组> <名> <风格> [--copy-from <现有风格>] [--desc <描述>]` | 新增风格（不限数量） | `POST /api/html/styles` |
| `html style switch <组> <名> <风格>` | 切换当前风格（面板默认预览它） | `POST /api/html/style-active` |
| `html style desc <组> <名> <风格> --text <描述>` | 设置风格描述（`--text ""` 清除） | `POST /api/html/style-desc` |
| `html style rm <组> <名> <风格>` | 删风格（连同其历史） | `POST /api/html/style-remove` |
| `html history list <组> <名> <风格>` | 列出编辑历史（最近 5 条） | `GET /api/html/history` |
| `html history read <组> <名> <风格> --entry <id>` | 读某条历史快照的代码 | `GET /api/html/history-entry` |
| `html history restore <组> <名> <风格> --entry <id>` | 恢复快照（当前状态再入历史） | `POST /api/html/history-restore` |

代码槽位 flag：`--code-html`（HTML 本体）、`--code-css`、`--code-js`。
HTTP body 用短键：`{group, name, style, html, css, js, tags}`（两条入口汇合成同一语义）。

## 筛选与搜索语义（100+ 资源的检索主入口）

- `--tags a,b`：**多选 AND**——资源必须同时带上全部标签（逐层收窄，找得快）；
  tree 响应里的 `availableTags`（含计数）可供 UI 渲染标签云，且**不受筛选影响**
- `--search <词>`：大小写不敏感子串，匹配 资源名 / 展示名 / 分组路径 / 标签 / 风格名
- 两者可叠加：`html tree --tags button --search 登录`
- 标签在资源级：`add --tags …` 建时打标；`tag add/rm` 事后维护；
  归一化（小写、空白转 `-`）在服务端做一次，AI 直接传原词即可

## 易错点（都实测过）

1. **多行代码必须 heredoc + `-`**，形状见 SKILL.md；`--code-html '<button>…\n…'`
   直接在参数里带换行会被切。
2. **风格与历史是两个层次**：想保留旧实现做对比 → `style add --copy-from`；
   只想改当前实现又能回退 → `put`（自动进历史，5 条滚动）。
3. `add` 不带 `--style` 时资源是空的（0 风格）——面板上先「新风格」或
   CLI 用 `style add` 建首个风格。
4. 删除前先 `tree` / `load` 确认目标；`blocked` 结果不是错误，
   是让你决定要不要加 `--force`。

## 面板协作

`node bin/ft.mjs serve` 打开「HTML 资源」tab：

- 左侧树 = 分组（面包屑显示在组名行）+ 资源；点资源进入编辑
- 右侧上：HTML / CSS / JS 三个编辑框（点标题栏折叠/展开），JS 默认收起
- 右侧下：实时预览（输入即刷新，`立即登录` 这类改动所见即所得）
- 工具条：风格下拉、保存（未保存显示 `保存 *`）、新风格、删风格、改名、删资源
- 「全屏展开」进入沉浸预览（Esc 或按钮退出）；预览里 `alert()` 等脚本正常执行
