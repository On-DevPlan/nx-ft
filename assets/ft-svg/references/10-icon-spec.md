# 10 · 图标规范全文

> 权威定义在 `src/core/svg/spec.js` 的 `ICON_SPEC`。这份文档是它的**人读版**：
> 每一条为什么这么定、违规时长什么样、`spec fix` 会把它改成什么。
> 面板的看板角标、`svg spec check` 的每一行、`svg spec fix` 的每一条改动，
> 都出自同一份定义——所以三者永远不会互相矛盾。

## 规范表

| # | 条目 | 取值 | 为什么 |
| --- | --- | --- | --- |
| 1 | `viewBox` | `0 0 24 24` | 全组共享同一套坐标。混用 32pt / 48pt 时，「看起来一样大」只能靠肉眼调，必然调不齐 |
| 2 | 网格 | 24pt | 足够放下细部，又小到能强制做减法。iOS / Material / Lucide 都落在这一档 |
| 3 | `stroke-width` | `1.8` | 24pt 网格在 16px 渲染时线宽约 1.2 设备像素，视觉上饱满但不糊。2.0 在 16px 下偏粗，1.5 偏虚 |
| 4 | `stroke-linecap` | `round` | 端点不圆时，斜线会露出一个方角，同组混用立刻显得糙 |
| 5 | `stroke-linejoin` | `round` | 同上。尖角与圆角混用比线宽不一致更容易被一眼看出 |
| 6 | 颜色 | `currentColor` | 唯一一条「写死就废掉」的规则。写死颜色 = 这个图标只能用在一个主题里 |
| 7 | 根属性 | `fill="none"`（线性档） | 不写时浏览器按 `fill: black` 渲染，路径会被填成实心块 |
| 8 | 尺寸 | **不写** `width`/`height` | 写了就锁死缩放。使用方需要多大由外层 CSS 决定 |

> 第 7、8 条属于档位 `line`；档位 `color` 只管第 1、6、8 条。
> 一张插画图形不该被强行改成描边风格，所以两档分开。

## 合规骨架

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <title>加号</title>
  <path d="M12 5v14M5 12h14"/>
</svg>
```

逐项对应：

- `xmlns` —— 作为独立 `.svg` 文件时必须（内联进 HTML 时可省）。
- `viewBox="0 0 24 24"` —— 规范第 1、2 条。
- `fill="none"` —— 规范第 7 条。注意它必须在**根**上，子图元的 `fill` 会覆盖它。
- `stroke="currentColor"` —— 规范第 6 条。写在根上即可，子图元继承。
- `stroke-width` / `linecap` / `linejoin` —— 规范第 3、4、5 条，同样放根上。
- `<title>` —— 可选但强烈建议：`svg import --label-from title` 直接取它当展示名。
- **没有** `width` / `height` —— 规范第 8 条。

## 违规对照表

`svg spec check` 输出的每一条都带 `code`；下表是「看到 code → 什么症状 → 怎么改」。

| code | 症状 | 手改 | 自动修 |
| --- | --- | --- | --- |
| `no-root` | 源码里找不到 `<svg …>` 根元素 | 补上根元素，或确认内容不是空壳 | ✗（改不了，需人介入） |
| `viewbox` | `viewBox` 不是 `0 0 24 24`，或整个缺失 | 换 viewBox 时**必须同时缩放内容**（见下节） | ✓ 会按比例缩放内容 |
| `fixed-size` | 根元素写了 `width` / `height` | 删掉这两个属性，尺寸交给 CSS | ✓ 直接移除 |
| `hardcoded-color` | `fill` / `stroke` / `color` 出现具体色值（`#2B3445`、`rgb(...)`、颜色名） | 换成 `currentColor` | ✓ 全部替换 |
| `empty` | 只有空壳 `<svg>`，没有任何图元 | 补路径 | ✗ |
| `fill` | 根元素 `fill` 不是 `none`（线性档） | 加 `fill="none"` | ✓ 补齐 |
| `stroke` | 根元素 `stroke` 不是 `currentColor`（线性档） | 改成 `currentColor` | ✓ 改成 `currentColor` |
| `stroke-width` | 根或**任意子图元**的线宽不是 `1.8` | 统一为 `1.8` | ✓ 全文档统一 |

`stroke-width` 一条要特别说明：检查范围是**整份文档**，不只根元素。
把 `stroke-width="2.4"` 写在某个 `<circle>` 上的图标，根上看起来完全合规，
但它渲染出来就是比同组粗一圈——「这一组看着不齐」十有八九是这么来的。

`level: error` 的两条（`no-root`、`empty`）是**阻断级**：图形本身不成立，
自动修不了，`spec fix` 会把它们列进 `failed` 而不是静默跳过。

## `spec fix` 到底改了什么

归一化严格按这个顺序执行（`normalizeSvg`）：

1. **颜色** —— 所有被判为「写死」的色值 → `currentColor`
2. **线宽** —— 全文档的 `stroke-width` → `1.8`（子图元也一起）
3. **坐标系** —— `viewBox` → `0 0 24 24`，**并把原内容整体包进 `<g transform>` 做等比缩放**
4. **根属性** —— 补 `fill="none"`、`stroke="currentColor"`、`linecap` / `linejoin`
5. **应用内容变换** —— 把第 3 步算出的变换真正写进 `<g>`

第 3 步是最容易做错的一步，单独说。

### 换 viewBox 必须同时缩放内容

`viewBox` 定义的是「用户坐标到视口的映射」。把 `viewBox="0 0 32 32"` 直接改成
`"0 0 24 24"`，**内容不会跟着缩小**——原来画在 16 处的圆心还在 16 处，
于是整个图形放大了 32/24 ≈ 1.33 倍，还被裁掉了右边和下边。

正确做法是包一层变换：

```html
<!-- 改前：32pt 网格式 -->
<svg viewBox="0 0 32 32" …><circle cx="16" cy="16" r="10"/></svg>

<!-- 改后：内容整体 ×0.75，视觉尺寸不变 -->
<svg viewBox="0 0 24 24" …><g transform="scale(0.75)"><circle cx="16" cy="16" r="10"/></g></svg>
```

`spec fix` 做的就是这件事。**当原 `viewBox` 的长宽比与 24×24 不一致时（例如 `0 0 32 16`），
它会拒绝迁移并保留原 viewBox**，只是在报告里说明原因——强行等比缩放会把图形压扁/拉长，
那比「不合规」更糟。

### 为什么批量修复也安全

`spec fix` 不直接覆盖文件，而是走 `styles.saveCode`：**改动前的状态会推入该风格的编辑历史**
（每风格保留最近 5 条）。所以批量改一百个图标是可逆的：

```bash
node bin/ft.mjs svg history list ui/icons plus default
node bin/ft.mjs svg history restore ui/icons plus default --entry <id>
```

代价是历史条数会被批量修复占掉几条——所以先 `--dry-run` 看清楚再动手。

## 不该做的事（反面清单）

| 反例 | 后果 |
| --- | --- |
| `<svg width="24" height="24" viewBox="0 0 24 24">` | 图标在 16px 容器里会被撑出格子；已写死的尺寸没法被 CSS 覆盖（除非用 `!important`） |
| `<path fill="#5B7CFA">` | 换主题后这个图标不跟随，成了「一个不肯变色的钉子」 |
| `<circle stroke-width="2.4">` | 根上合规、渲染不合群，是最难查的一类缺陷 |
| 把 24pt 的图形硬塞进 `viewBox="0 0 48 48"` 不缩放 | 视觉上放大一倍；导出到组件库后会与其它图标明显不齐 |
| `<style>.cls{fill:#333}</style>` | 同样算写死颜色（`collectColors` 连 CSS 声明一起扫），且优先级会盖过属性 |
| 用 `transform="translate(...)"` 来「居中」 | 内容偏移不体现在 `viewBox` 上，后续缩放会带着偏移一起放大，越调越歪 |

## 自检清单（交付一组图标前跑一遍）

```bash
node bin/ft.mjs svg spec check <组>          # 应输出：待规范 0
node bin/ft.mjs svg spec fix <组> --dry-run  # 应输出：改动 0 个
```

两条都干净，就只能说明「三者一致」；造型是否成立、笔画词汇是否统一，
回到 [20-icon-set-method.md](20-icon-set-method.md) 的评审清单。
