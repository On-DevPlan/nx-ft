# 20 · SVG 资源：命令速查与协作要点

> 本文件是 `SKILL.md` 的配套速查。svg 与 html 共用同一套存储、分组、标签、
> 风格、编辑历史机制，命令**完全同构**（前缀换成 `svg`）。差异有两处：
> 代码槽位是 `--code`（SVG 本体，HTTP body 键为 `svg`）而不是 `--code-html`；
> 以及在共用命令之上多了一组 **svg 专属命令**（看板 / 批量 / 规范）。
>
> 标签与筛选语义见 [`10-html-resources.md`](10-html-resources.md)「筛选与搜索语义」一节，
> svg 侧完全一致（`svg tree --tags icon,outline`、`svg tag add …`）。
>
> **做图标**（一致性、网格、线宽、批量导入导出、规范审计）请看配套 skill
> [`ft-svg`](../../ft-svg/SKILL.md)——那里是「图标这件事本身」的标准；
> 这里只讲**命令面**。

## 共用命令（与 html 逐条同构）

| 命令 | 用途 | 对应 HTTP |
| --- | --- | --- |
| `svg tree [--search <词>] [--tags a,b]` | 列出分组与资源（可按标签 AND / 关键词筛选） | `GET /api/svg/tree` |
| `svg group add <组> [--label]` | 建分组（1~8 段路径，支持多层） | `POST /api/svg/groups` |
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
| `svg history restore … --entry <id>` | 恢复快照（当前状态再入历史） | `POST /api/svg/history-restore` |

代码槽位 flag：`--code`（SVG 本体）、`--code-css`、`--code-js`。
HTTP body 短键：`{group, name, style, svg, css, js}`。

**风格描述**（`style desc`）在多风格并存时特别有用：光看风格名看不出
`alt` 与 `bold` 差在哪，描述是唯一说清「这套实现的特征」的地方，
面板的资源页会把它显示在每张风格卡上（如「圆角更小，适合密集列表」）。

## svg 专属命令

| 命令 | 用途 | 对应 HTTP |
| --- | --- | --- |
| `svg board [--search] [--tags]` | 看板数据：整库图标 + 当前风格的 SVG 源码 + 规范审计 | `GET /api/svg/board` |
| `svg detail <组> <名>` | 资源详情：**全部风格**各自的源码与审计（多风格对比用） | `GET /api/svg/detail` |
| `svg cat <组> <名> [--style] [--slot svg\|css\|js]` | 打印**裸源码**（可管道：`svg cat … > f.svg`） | `GET /api/svg/cat` |
| `svg import <组> --from <目录> [--style] [--tags] [--recursive] [--label-from filename\|title] [--dry-run]` | 批量导入一个目录 | `POST /api/svg/import` |
| `svg export [<组>] --to <目录> [--style] [--board] [--force]` | 批量导出（目录 + 自包含 `index.html` 看板页） | `POST /api/svg/export` |
| `svg spec show` | 打印图标规范与合规骨架 | `GET /api/svg/spec` |
| `svg spec check [<组>] [--profile color\|line]` | 规范审计：逐条列出不合规的图标与原因 | `GET /api/svg/spec-check` |
| `svg spec fix [<组>] [--style] [--profile] [--dry-run]` | 批量归一化（改动进编辑历史，可回退） | `POST /api/svg/spec-fix` |

`check` 与 `fix` 的分组参数都是**可选**的：不传 = 整库。`fix` 只修「当前风格」
或 `--style` 指定的那一个，不提供「所有风格一起修」——那会抹平刻意保留的对比版本。

`--profile`：`line`（线性图标，默认）管几何 + 颜色 + `fill/stroke/线宽/线帽`；
`color` 只管几何 + 颜色。插画类图形用 `color`，不要用 `line`。

## 典型用法

```bash
# 建一枚合规的线性图标（骨架来自 svg spec show）
node bin/ft.mjs svg group add ui/icons --label 图标
node bin/ft.mjs svg put ui/icons arrow-up --style line --code - <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <title>向上</title>
  <path d="M12 19V5M5 12l7-7 7 7"/>
</svg>
EOF

# 再造一个风格做对比，写清它和前一版的差别，然后自检
node bin/ft.mjs svg style add ui/icons arrow-up alt --copy-from line --desc '更粗的箭头，适合强调态'
node bin/ft.mjs svg put ui/icons arrow-up --style alt --code '<svg …>…</svg>'
node bin/ft.mjs svg spec check ui/icons

# 一整个目录导进来，导出时带一张看板页
node bin/ft.mjs svg import ui/icons --from ./icons/outline --label-from title
node bin/ft.mjs svg export ui/icons --to ./out/icons
```

## 易错点

1. **多行 SVG 必须 heredoc + `-`**（`--code - <<'EOF'`），与 html 一致。
   flag 必须写在 `<<'EOF'` **之前**，定界符要带引号，`EOF` 要顶格。
2. 写死 `width` / `height` 会让图标无法按容器缩放；写死颜色会让它无法换肤。
   两者 `svg spec check` 都会报出来。规范细节见
   [`ft-svg/references/10-icon-spec.md`](../../ft-svg/references/10-icon-spec.md)。
3. 线宽检查是**全文档**的：把 `stroke-width` 写在某个子图元上，
   根元素看起来完全合规，渲染出来却比同组粗一圈——这是「一组图标看着不齐」的常见成因。
4. `svg cat` 的输出是**裸源码**（不经 JSON 引号包裹），就是为了能直接管道：
   `svg cat ui/icons plus > plus.svg`，改完 `svg put … --code - < plus.svg`。
5. 面板改动**只在点保存后落盘**；CLI 立刻 `cat` 到的是旧内容属于正常。

## 面板协作

`node bin/ft.mjs serve` 后打开「SVG 资源」tab（默认端口 7869）。svg 面板是**四层页面**，
不是 html 面板的孪生（但**共用同一套 URL 词汇**，见下）：

| 路由 | 页面 |
| --- | --- |
| `#/svg` | 看板：整库图标 + 规范状态 + 批量导入导出 / 自检 / 一键归一化 |
| `#/svg/dir/<组路径>` | 分组页：这一支的图标与子分组（对应资产域的 dir） |
| `#/svg/edit/<组路径>/<名>` | 资源页：多风格对比 + 三槽位编辑器 + 规范问题 + 历史回退（对应 edit） |
| `#/svg/edit/<组路径>/<名>/full` | 整页预览：尺寸阶梯 + 24pt 网格 + 明暗底色 |

`dir` / `edit` 与「HTML 资源」tab 是同一套词汇，两个 tab 之间切换不用重记路由。
看板与批量操作的完整说明见
[`ft-svg/references/30-board-and-batch.md`](../../ft-svg/references/30-board-and-batch.md)。
