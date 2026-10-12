# 01-svg：SVG 资产独立入库

> 目的：让用户做 fr/ 等前端设计工作时产生的矢量资产有去处，能被检索引、能被 Studio 面板消费、能被 CLI/HTTP 同源访问。

## 形状

`src/svg/<group>/{spec.json, *.svg}` —— 一组一 spec，与 `src/styles/<pack>/` 同构。

为什么是 **per-folder** 而不是 per-file 粒度的 spec：

- **目录是天然分组**——`icons/` `decorations/` `illustrations/` 各自语义清楚，无需额外「分组 ID」字段
- **组的元数据只写一次**——`title / description / viewBox` 写在 spec，items 自然继承
- **加新组零阻力**——`cp -r _template <new-group>` 然后改 id + 拖文件

## 走过的路（取舍记录）

| 候选 | 选 / 不选 | 原因 |
|---|---|---|
| 顶层 `assets/svg/` | 不选 | `assets/` 当前是 SKILL 文档通道（`assets/nx-ft/`），不混用；`src/` 已被 `package.json#files` 全量收录，零额外配置 |
| Per-file spec（每个 .svg 一份 spec.json） | 不选 | 元数据（title/description/viewBox）每个文件重写一遍太冗余；用户要"按文件夹"自然分组 |
| 自动按文件名猜 tag | 不选 | 用户明确选了"手工编目"；自动猜错会污染索引 |
| 自动建索引（扫盘所有 .svg） | 不选 | 必须有 spec 才能保证元数据完整；纯扫盘 = 把孤儿也算资产 |
| 在 Studio 加 drag-drop 上传 | 不选 | 资产走文件系统、版本由 git 管；UI 上传与 git workflow 互斥 |

## 4 个 action 的语义边界

| action | CLI | HTTP | 谁触发 |
|---|---|---|---|
| `svg.manifest` | `nx-ft svg list` | `GET /api/svg/manifest` | 面板初次加载、agent 摸底 |
| `svg.group` | `nx-ft svg get <group>` | `GET /api/svg/group/:group` | 面板切组、agent 拉详情 |
| `svg.preview` | `nx-ft svg preview <group> <item>` | `GET /api/svg/preview/:group/:item` | 面板单件预览、agent 拿 HTML 文档 |
| `svg.build` | `nx-ft svg build` | (CLI-only) | 手动重建 catalog（一般走 `studio build` 链路） |

**不**给每个 .svg 一个 GET 端点——`/api/svg/preview/:group/:item` 已能拿全文，组内 N 个文件只需 1 个路由参数。

## 一些刻意不做的事

- **不做 SVG 编辑器**——编辑器属于 Figma / Inkscape / VSCode 生态
- **不做拖拽上传 UI**——git 管资产比 UI 上传更稳
- **不做按文件名自动猜 tag**——用户已选手工
- **不做跨 pack 着色**——SVG 是 raw，色由 caller 决定（保持 viewBox 内 `currentColor`）
- **不做 SVG → React 组件 codegen**——view 直接 `dangerouslySetInnerHTML` 嵌入，更轻
- **不接 fr/ 同步**——fr/ 是参考的真实项目，不在 nx-ft 范围

## 后续可能加的（v0 不做）

1. `spec.items[].source` 字段记录出处（哪个项目画的、版权）
2. 多 viewBox / 多尺寸（icon-16 / icon-24 / icon-32）打包
3. SVG 文本里的 token 替换（`{{color}}` → `var(--ink)`），让 SVG 自带主题
4. `<picture>` 风格的 <use> 引用支持（同一 viewBox 多份 path 切换）
