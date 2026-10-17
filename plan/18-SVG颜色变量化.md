# 18 SVG 颜色变量化：调色从「预览层替换」升级为原生 CSS 变量（P1）

来源：KV nxft 任务「svg 现在调整颜色的原理是什么？我希望更加工程化和模板化；
svg 有变量语法或者模板语法吗？对颜色配置更原生亲和 svg 平台」。

## 现状：现在调色的原理（已核实，三层）

1. **主题色（currentColor）**：`preview/doc.js` 的 `buildSvgDoc` 给预览 iframe 的
   `#app` 注入 `color:<main>`——SVG 里写 `currentColor` 的部分跟着变。这是 SVG 原生
   语义，源码零改动。
2. **局部硬编码色**：`color-panel.jsx` 的 `collectHardcoded` 正则扫出 fill/stroke/color
   字面量；预览时 `applySvgSlots` 对源码字符串做**整体替换**（`#2B3445` → 选中的色）。
   源码不动、刷新即失、导出走原文件——快，但不是任何一种「模板」。
3. **绑定关系只活在面板 state 里**：哪个字面量对应哪个槽，不落在文件上。

**SVG 平台有原生变量语法**：CSS 自定义属性（`var(--name)`）。对 SVG 而言：
- `<style>` 里的 CSS 规则用 `var()` —— 所有渲染环境通用（浏览器、`<img>` 内嵌 SVG、
  独立文件），这是规范保证的路径；
- 展现属性里的 `var()`（`fill="var(--x)"`）浏览器实现不一，**不走**；
- inline `style` 属性是普通 CSS，`var()` 全环境可用——字面量迁移的落点。

## 处理意图：颜色 = 文件里的变量声明 + 一处主题层

模板化后的 SVG 长这样（自包含：拷走变量声明失效也有 fallback 兜底）：

```svg
<svg ...>
  <style>svg{--c-1:#2B3445;--c-2:#FFB0A5}</style>   ← 主题层：一处声明，全文件生效
  <path style="fill:var(--c-1,#2B3445)" d="..."/>    ← 用法：原属性值迁进 style，带 fallback
  <circle style="stroke:var(--c-2,#FFB0A5)"/>
</svg>
```

- **调色 = 改声明**：颜色面板的槽位变成变量；预览时在 iframe 文档尾部追加一条
  `svg{--c-1:覆盖值}` 的覆盖样式（同选择器、后来居上），**不再对源码做任何字符串手术**；
- **模板化迁移**：面板一键「把 N 个字面量迁为变量」——属性字面量迁到 inline style
  （`fill="#x"` → `style="fill:var(--c-N,#x)"`，已有 style 则合并），`<style>` 块内的
  字面量原地换成 `var(--c-N,#x)`；生成结果写回 SVG 编辑器（脏态，用户过目后保存）；
- **保留既有能力**：currentColor 主题色照旧；未迁移的字面量槽照旧（applySvgSlots
  兼容路径不动）；重置 = 清空覆盖；
- 引擎（解析声明 / 迁移 / 覆盖样式生成）独立成纯函数模块，node 单测钉死；
  前端不能 import core（lint 分层规则），引擎放 `components/svg/color-vars.js`
  （与 color-panel 复刻 COLOR_RE 同一先例）；core/svg/spec 的归一化集成后续再看。

## 改动

- `svg/color-vars.js`（新，纯函数）：`parseVarDecls` / `migrateToVars` /
  `varOverrideCss` / `collectHardcoded`（自 color-panel.jsx 迁入）。
- `preview/doc.js`：`buildSvgDoc` 的 theme 增加可选 `vars`，文档尾追加覆盖样式。
- `svg/color-panel.jsx`：槽位 = 变量（读声明）+ 遗留字面量；变量槽改写覆盖；
  「迁移为变量」按钮。
- `svg/detail.jsx`：接线迁移动作（写回编辑器 textarea + input 事件 → 脏态）。
- `tests/unit/svg-color-vars.test.mjs`（新）：解析 / 迁移 / 去重 / 幂等 / 覆盖。

## 验收

- [ ] 面板对未迁移资源行为不变（主题色 + 字面量槽 + 色板）
- [ ] 「迁移为变量」后：源码出现声明块与 var 用法（预览不变色），编辑器进脏态
- [ ] 变量槽选色 → 预览实时变（覆盖样式），重置复原；源码始终不动
- [ ] 迁移幂等：再点一次不产生第二份声明
- [ ] 导出/保存的文件自包含（声明 + fallback），脱离面板按声明色渲染
- [ ] `pnpm test` 全绿
