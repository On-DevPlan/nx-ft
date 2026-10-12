# `src/svg/` — SVG 资产独立入库

按 **per-folder** 粒度组织：一组 SVG = 一个子目录 + 一份 `spec.json` + 多个 `.svg`。
与 `src/styles/<pack>/` 同构（都是「目录是天然分组」），但更轻——SVG 是矢量，不是带 class 契约的组件。

## 加一个组（5 步）

```bash
# 1. 复制模板
cp -r src/svg/_template src/svg/my-group

# 2. 改 id / title / description（id 必须等于目录名）
#    编辑 src/svg/my-group/spec.json

# 3. 拖入 .svg 文件
cp /path/to/icon-1.svg src/svg/my-group/
cp /path/to/icon-2.svg src/svg/my-group/

# 4. 把每个 .svg 在 spec.items[] 里登记（file / name / title / tags）
#    编辑 src/svg/my-group/spec.json

# 5. 重建 catalog（manifest:build 已包含 loadSvg）
pnpm run build
```

## spec.json schema

```jsonc
{
  "id": "decorations",         // required: 必须等于目录名（test 断言）
  "kind": "svg-group",         // required: 写死 "svg-group"，与 components / registry 区分
  "title": "装饰元素",          // required: 人类可读
  "description": "…",          // required: 一句话用途
  "viewBox": "0 0 120 12",     // optional: 组级默认 viewBox；item 可覆盖
  "items": [                    // required: 本组资产清单
    {
      "file": "squiggle.svg",   // required: 同目录下的 .svg 文件名
      "name": "squiggle",       // required: URL 路由 param (slug)
      "title": "波浪线",         // required: 人类可读
      "tags": ["divider", "ornament"],  // optional
      "viewBox": "0 0 120 12"   // optional: 覆盖组级默认
    }
  ]
}
```

## 重要约束（test 会拦下）

1. **`spec.id` 必须等于目录名**——漂移会立刻测试失败
2. **每个 `items[].file` 必须实际存在**——孤儿反向断言
3. **磁盘上的 `.svg` 必须出现在 `items[]` 里**——孤儿反向断言
4. **`.svg` 文件必须 well-formed XML**——`@xmldom/xmldom` 解析失败就报
5. **不要把 `_template/` 计入 catalog**——它只是新组起步模板

## 使用入口

- **CLI**：`nx-ft svg list` / `nx-ft svg get <group>` / `nx-ft svg preview <group> <item>` / `nx-ft svg build`
- **HTTP**：`GET /api/svg/manifest` / `/api/svg/group/:group` / `/api/svg/preview/:group/:item`
- **Studio**：切到 "SVG 资产" tab，左/上选组，网格点开看单件

## 出处字段（v0 暂未实现 schema 扩展）

未来给 spec 加一个可选 `source` 字段记录出处（哪个项目、谁画的、版权），
避免外部 SVG 混入时丢源。今天先口头约定。
