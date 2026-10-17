# 08 色彩域局部导入导出（P1）

来源：KV nx-rh localtask id=11「目录树的右键功能菜单需要支持局部导入导出；html 和 svg
和色彩都需要支持局部的导出、导入到某目录下」。

id=2 已让 **html / svg** 右键目录支持「导入到该目录 / 导出该目录」（zip）。**color 域**
侧边栏（同一个 AssetSidebar / side-tree）菜单里其实已经显示这两项，但后端 zip 路由的
分派表只注册了 svg、html，点 color 会 404。本次给 color 补上——它的存储结构与 html
同族（一资源一目录、core/assets 体系），只是槽位不同（单 `data` 槽），复用同一份
kind 驱动的 set.js 即可，不另写。

主战场：
- 槽位/文件名映射：`core/assets/set.js`（FILES）
- zip 路由分派：`runtime/zip-upload.js`（IMPORTERS）、`runtime/zip-download.js`（EXPORTERS）

## 现状（已核实）

- color 资源：`ASSET_KINDS.color = { label:'色彩资源', slots:['data'] }`，data 槽存
  Palette JSON；codeFilePath 直接用 slot 名当文件名，即
  `<group>/<name>/styles/<style>/data`（无扩展名）。
- `core/assets/set.js` 的 `FILES = { html:'index.html', svg:'icon.svg', css:'style.css', js:'script.js' }`
  ——**没有 `data` 槽位的文件名**，sourcesFromZip 找不到 `data` 文件会跳过。
- `IMPORTERS = { svg, html }`、`EXPORTERS = { svg, html }`——**没有 color**。
- 前端 useZipIo / side-tree 完全 kind 驱动，URL 模式三域一致，前端无需改。

## 方案

### 8.1 core/assets/set.js 支持 color

- FILES 加 `data: 'data'`（slot 名与文件名相同，与 storage 的 codeFilePath 一致）。
- color 的导入 label：data 是 Palette JSON（没有 `<title>`），从 JSON 的 `name` 字段取
  展示名，解析失败再回退目录名（buildImportPlan 里按 kind 分支）。

### 8.2 注册 zip 路由

- `zip-upload.js`：`IMPORTERS.color = importAssetZip`（与 html 同一份）。
- `zip-download.js`：`EXPORTERS.color = exportAssetZip`。
- 导入：zip 里每个资源一个目录、内含 `data` 文件 → 落到目标 group；
  导出：pick 目录递归，每个资源打包 `<group>/<name>/data`。

## 验收（已完成）

- [x] 右键 color 目录 → 导出该目录：下载 color-pick-1.zip，含 `demo/primary/data`（7 色）
- [x] 右键 color 目录 → 导入到该目录：zz-color-io 下导入 primary，结果窗 [data] 2275 B
- [x] 导入的调色板 label 取自 Palette JSON 的 name（"主色板"）
- [x] html / svg 既有导入导出不回归（复用同一份 kind 驱动 set.js）
- [x] 全量 lint / build 零产物 diff / smoke 10 / unit 107（新增 2 个 color 用例）/ uiux 100
- [x] 本轮以 `nx-kv localtask wait`（--cwd、--summary、--json）收尾
