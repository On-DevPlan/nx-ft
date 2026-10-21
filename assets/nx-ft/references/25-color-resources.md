# 25 · 色彩资源：命令速查与协作要点

> 本文件是 `SKILL.md` 的配套速查。**先读 SKILL.md 的数据模型一节**，这里只列
> color 域的命令、跨域差异与易错点。
>
> 调色板这件事本身（Palette JSON 形状、和声派生、导出格式）看配套 skill
> [`ft-color`](../../ft-color/SKILL.md)——那里是「调色板集」的标准；
> 这里只讲**命令面**。

## 与另两域的关系（先对齐，再动手）

三域共用同一套存储模型与 **24 条通用命令**（分组 / 资源 / 风格 / 历史 / 标签 / 排序 / reveal），
`color` 只是**槽位不同**：单个 `data` 槽，装一整段 Palette JSON。

| 域 | 槽位 flag | 一个资源是什么 |
| --- | --- | --- |
| `html` | `--code-html` / `--code-css` / `--code-js` | 一个场景 |
| `svg` | `--code` / `--code-css` / `--code-js` | 一枚图形 |
| `color` | `--code-data` | 一个调色板（Palette JSON） |

## 通用命令（与 html 逐条同构，前缀换 `color`）

| 命令 | 用途 | 对应 HTTP |
| --- | --- | --- |
| `color tree [--search <词>] [--tags a,b]` | 列出分组与资源（标签 AND / 关键词筛选） | `GET /api/color/tree` |
| `color group add <组> [--label]` | 建分组（1~8 段路径，支持多层） | `POST /api/color/groups` |
| `color group reorder [--parent <组>] --order a,b` | 同级分组排序 | `POST /api/color/groups-reorder` |
| `color group rename <组> [--to <新路径>] [--label]` | 改路径或只改展示名 | `POST /api/color/groups-rename` |
| `color group rm <组> [--force]` | 删分组（非空需 --force） | `POST /api/color/groups-remove` |
| `color add <组> <名> [--label] [--style] [--tags a,b] --code-data <JSON>` | 新建调色板（`--code-data` 必填） | `POST /api/color/assets` |
| `color load <组> <名> [--no-code]` | 资源详情（标签 + 风格 + 历史清单） | `GET /api/color/asset` |
| `color put <组> <名> [--style] --code-data <JSON>` | 改写 data 槽位（改动前进历史） | `POST /api/color/asset-code` |
| `color rename <组> <名> [--label] [--to]` | 改展示名 / 改目录名 | `POST /api/color/asset-rename` |
| `color asset reorder [--group <组>] --order a,b` | 同组资源排序 | `POST /api/color/asset-reorder` |
| `color desc <组> <名> --text <描述>` | 资源级主描述 | `POST /api/color/asset-desc` |
| `color tag add <组> <名> --tags a,b` | 加标签（幂等；已存在则 skipped） | `POST /api/color/tags-add` |
| `color tag rm <组> <名> --tags a,b` | 移除标签 | `POST /api/color/tags-remove` |
| `color move <组> <名> --to <目标组>` | 搬资源（风格与历史跟着走） | `POST /api/color/asset-move` |
| `color rm <组> <名> [--force]` | 删资源（含风格需 --force） | `POST /api/color/asset-remove` |
| `color style add <组> <名> <风格> [--copy-from] [--desc] [--code-data]` | 新增风格（不限数量） | `POST /api/color/styles` |
| `color style switch <组> <名> <风格>` | 切换当前风格 | `POST /api/color/style-active` |
| `color style desc <组> <名> <风格> --text <描述>` | 设置风格描述（空串清除） | `POST /api/color/style-desc` |
| `color style rm <组> <名> <风格>` | 删风格（含历史） | `POST /api/color/style-remove` |
| `color history list <组> <名> <风格>` | 编辑历史（最近 5 条） | `GET /api/color/history` |
| `color history read <组> <名> <风格> --entry <id>` | 读历史快照 | `GET /api/color/history-entry` |
| `color history restore <组> <名> <风格> --entry <id>` | 恢复快照（当前状态再入历史） | `POST /api/color/history-restore` |
| `color reveal [组] [--name <资源名>]` | 在文件管理器里打开该目录 | `POST /api/color/reveal` |

HTTP body 短键：`{group, name, style, data, tags}`（两条入口汇合成同一语义）。

## color 专属命令（3 条）

| 命令 | 用途 | 对应 HTTP |
| --- | --- | --- |
| `color list <组>` | 组内所有调色板与色卡（含派生来源标记） | `GET /api/color/list` |
| `color entry add <组> <名> <hex> [--note] [--tags a,b]` | 追加一个色卡 | `POST /api/color/entry-add` |
| `color entry rm <组> <名> --hex <hex>` / `--id <id>` | 删一个色卡 | `POST /api/color/entry-rm` |

`export` 三域都有但**语义不同**——它是跨域最常见的误用点：

| 域 | `export` 产出 | 有 `import` 吗 |
| --- | --- | --- |
| `html` | **目录**：`<组>/<资源>/{index.html,style.css,script.js}` | 有（目录 / zip） |
| `svg` | **目录**：`<组>/<资源>/{*.svg,index.html 看板页}` | 有（目录 / zip） |
| `color` | **文本**：`--format css\|json\|tailwind\|toml`（整组） | **没有**——回写用 `put --code-data` |

## 典型用法

```bash
# 建一组品牌色
nx-ft color group add brand --label 品牌色
nx-ft color add brand primary --label 主色板 \
  --code-data '{"name":"主色板","harmony":null,"colors":[],"sortBy":"manual"}'

# 逐色加（比整段重写 JSON 省事）
nx-ft color entry add brand primary "#5B7CFA" --note 主色 --tags brand,action
nx-ft color entry add brand primary "#845EF7" --note 辅助 --tags brand,accent

# 导出给前端工程用
nx-ft color export brand --format tailwind
nx-ft color export brand --format css
```

## 易错点（都实测过）

1. **`color entry rm` 的 hex 是 flag（`--hex`），不是位置参数**——
   写成 `color entry rm brand primary "#5B7CFA"` 会被 CLI 拒（「多余的参数」）。
2. **`color history list` 的风格是必填位置参数**（`<组> <名> <风格>`），没有默认值。
3. **多行 Palette JSON 必须 heredoc + `-`**（`--code-data - <<'EOF'`）：flag 写在
   `<<'EOF'` 之前、定界符带引号、`EOF` 顶格——与 html/svg 同一条铁律。
4. **改内容只有 `put --code-data` / `entry add` / `entry rm` 三条路**。
   直接改磁盘上的 data 文件会绕过编辑历史，改坏了回不去。
5. **派生色别手改**：带 `derivedFrom` 角标的色卡由和声规则算出来，槽位身份是
   `(paletteId, slot)`；手改 hex 会在下次重派生时被覆盖。形状见
   [`ft-color/references/A02-数据契约.md`](../../ft-color/references/A02-数据契约.md)。

## 面板协作

`nx-ft serve` 后打开「色彩资源」tab（默认端口 7869）。三个 tab **共用同一套网盘布局
与 URL 词汇**（`dir` / `edit`），色彩域多一条全屏入口：

| 路由 | 页面 |
| --- | --- |
| `#/color` | 根目录（网盘页）：当前层的调色板 + 内联新建 |
| `#/color/dir/<组路径>` | 进入某个文件夹 |
| `#/color/edit/<组路径>/<名>` | 资源页：单槽 DATA 编辑器 + swatch 预览 + 历史回退 |
| `#/color/edit/<组路径>/<名>/full` | **全屏 Studio**：色盘 / 比例 / 笔刷三视图 + 导入导出弹窗 |

全屏 Studio 里改锚色 / 拖色轮，**保存后才会落盘**；CLI 立刻 `load` 到的是旧内容属于正常。
和声派生、槽位继承、导出格式的完整说明见
[`ft-color/references/A01-工作流.md`](../../ft-color/references/A01-工作流.md)。
