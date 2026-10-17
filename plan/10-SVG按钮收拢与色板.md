# 10 SVG 编辑页：按钮收拢 + 主题色板 + 局部颜色控制

来源：KV nx-rh localtask id=6「Svg 编辑页右上角按钮太多太复杂，收拢；主题色受程序控制的，
编辑页应提供对应色板，实时看颜色响应；支持 svg 局部颜色控制和变化」。

## 现状

SVG 详情页（`components/svg/detail.jsx`）共 9 个按钮：

- page-head：整页预览、编辑历史、按规范修复、保存（主）
- ident-row：新风格、设为当前、改名、删风格、删图标（danger）

图标规范的颜色一律 `currentColor`（`core/svg/spec.js`），颜色由 CSS `color` 控制；
`collectColors(src)` 已能收集 SVG 里的硬编码颜色字面量。

## 10.1 收拢按钮（复用 BtnMenu）

- **page-head**：保留「保存」主按钮；「整页预览 / 编辑历史 / 按规范修复」收进一个
  `BtnMenu`（label「更多」）。
- **ident-row**：保留「新风格」（高频创建）；「设为当前 / 改名 / 删风格 / 删图标」
  收进一个 `BtnMenu`（label「更多」，删图标 danger）。

## 10.2 预览支持主题色与局部颜色替换（doc.js）

`buildSvgDoc(code, theme)` 增加 `theme` 参数：

- `theme.main`（currentColor 主题色）→ 注入 `#app{color:<hex>}`，currentColor 实时变色。
- `theme.slots`（`{ 原颜色字面量: 新hex }`）→ 对 SVG 源码做颜色字面量替换（复用
  COLOR_PROP 同款正则，只在预览 doc 里替换，**不改用户源码**）。
- 不传 theme 时行为与现在完全一致（白底、currentColor=黑）。

## 10.3 色板面板（新增 components/svg/color-panel.jsx）

预览区底部可折叠抽屉（点「颜色」展开/收起）：

- **颜色槽**：解析当前 SVG——主题色槽（currentColor）+ 各硬编码色（collectColors），
  每个槽显示当前颜色，点选「当前要改哪个槽」。
- **色板**：从 color 域 `/api/color/tree` + 各 palette data 加载全部颜色；
  取不到时回退一组常用色。外加 hex 输入框。
- 点色板颜色 → 写入对应槽（主题色→theme.main；硬编码色→theme.slots）→ 预览实时响应。
- 「重置」清空所有替换，回到源码原色。

## 10.4 边界

- 替换只作用于预览，不写脏源码、不触发保存；用户要落地改色，自己在编辑器里改或另走「按规范」。
- 切风格 / 切资源时重置 theme（各资源颜色槽不同）。

## 验收

- [ ] 页头与 ident-row 只剩主按钮 + 新风格 + 「更多」，菜单内动作齐全
- [ ] 色板点色 → currentColor 图标实时变色；硬编码色槽可局部替换
- [ ] 重置恢复原色；切风格重置
- [ ] 全量 lint / build 零产物 diff / smoke / unit 全绿；uiux 守 100
- [ ] 本轮以 `nx-kv localtask wait`（--cwd、--summary、--json）收尾
