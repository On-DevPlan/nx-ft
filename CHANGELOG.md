# 更新日志

本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## 0.5.1

### 修复：点了和声规则但列表里不出现派生色

- **根因**：两道闸门叠加——点规则时 `autoFill` 默认 `false`，而 `applyAutoFill` 内部见 `autoFill=false` 直接走「清理」分支；`useAutoFillEffect` 的指纹又只含 `(锚色, 类型)` 不含 `autoFill`，之后再勾选框也因指纹未变而早退。结果：色盘上有预览标记，颜色列表里永远不出现派生色。
- **修法**：点规则立即强制派生一次（`applyAutoFill(..., { force: true })`，`autoFill` 复选框只管「锚色后续变化是否自动重派生」）；指纹加入 `autoFill` 位；选「无」现在真正清掉和声数据（此前只藏 overlay，`harmony` 字段残留）；关闭 `autoFill` 的语义从「删除派生色」改为「冻结当前派生集」。
- 附带回归脚本 `scripts/test-harmony-click.mjs`（点规则 → 切规则 → 清除，三步断言槽位复用与清理）。

## 0.5.0

### 色彩模块（新）：调色板资源 + 全屏 ColorStudio

- **新增 `color` 资源域**：每个资源 = 一个调色板（Palette JSON，存 `data` 槽位），分组/风格/编辑历史与 html/svg 完全同构
- **CLI 24 条命令**：共享 CRUD/历史 19 条 + 专属 5 条（`color list` / `entry add` / `entry rm` / `export` / `put` 带 default 风格）
- **`color export --format css|json|tailwind|toml`**：整组调色板一键导出为 CSS 变量 / Tailwind config / 设计 tokens
- **全屏 ColorStudio**（`#/color/edit/<组>/<调色板>/full`，强制 `position:fixed; inset:0`）：从 ve 项目 color-studio 1:1 复刻 55 文件——色盘 / 比例 / 笔刷三视图、导出/导入/案例三模态、滤镜栈、快捷键自定义
- **三处跨包依赖替换**：KV 后端 → `/api/color/*` 本地路由（数据 100% 落盘 `~/.nx-ft/assets/groups/color/`）；JWT 鉴权 → 「本地存储」占位；Vue 跨框架桥 → 纯 React FileDropZone
- **和声派生槽位身份**：`derivedFrom` 增加 `slot` 字段，切换 三角/类似/分裂互补/单色 时复用同一批槽位就地更新（不再重复创建色卡）；移除 `complementary` 规则，历史数据自动迁移
- **网盘页体验**：色卡 swatch 缩略图（前 5 色）、卡片右上「Studio →」快捷直达全屏、空调色板 hero 引导（输入名一键建示例板）、noun 本地化（「调色板」）

### 面板：资产域通用增强

- `AssetView` 新增 `toolbar` / `emptyState` 插槽（领域注入动作与空态引导）
- 资源卡片新增 `quickAction` 槽位（hover 快捷按钮）；`title` 按 kind 分支（「打开调色板」）
- 工作台加载失败：中文错误提示 + 重试 / 返回网盘按钮（此前是英文堆栈直接吞掉）
- 搜索占位 / 统计行按域适配（「搜索调色板 / 分组 / 标签」「1 个调色板」）

### 本地化与交互细节（Studio 内）

- 状态徽标（空闲/保存中/已同步/出错）、WCAG 等级（对黑: AA(合格)）、Cookbook 标题（色彩工坊 · 案例手册）、导出文件头全部中文化
- ImportModal 3 处原生 `alert` → 页内 toast（项目「禁原生弹窗」约定）
- 三个模态支持 **Esc 关闭**；底部快捷键提示改为 `<kbd>` 键帽渲染，跟随用户自定义键位实时同步
- Studio 顶栏新增「← 返回工作台」，三态（网盘/工作台/全屏）导航闭环

### 修复

- 修 `svg import` 导入到不存在分组时必报「未知资源类型: undefined」的缺陷（`addGroup` 漏传 `kind`）

## 0.4.1

### 发布流水线：修好 OIDC 发布（仅 CI，无功能改动）

- npmjs.com 上为 `nx-ft` 配好 Trusted Publisher，发版由 GitHub OIDC 换票完成，
  不再需要 `NPM_TOKEN` 秘密
- 此前每次发布都失败在 registry 换票（`OIDC token exchange error - package not found`），
  而 npm 把换票异常静默吞掉、面上只剩 `ENEEDAUTH`：之前那些「发布成功」都是
  人工先手工 `npm publish`、流水线再因幂等跳过发布而空跑出来的假绿
- 新增 OIDC 预检步骤：走 npm 原生取票路径（`npm publish --dry-run`）验证信任关系，
  要发布时失败即硬失败；`workflow_dispatch` 可手动触发验证，不必等下次发版
- actions 升到 node24 运行时（checkout v7 / setup-node v7 / pnpm-action-setup v6），
  消掉 Node 20 降级告警

## 0.4.0

### 面板：HTML / SVG 两个 tab 统一为网盘式浏览

- 去掉左侧常驻目录树：面包屑即地址栏，点文件夹卡片下行、点面包屑回跳，目录导航同步 URL
- 创建改为**内联输入行**（只起名，回车即建），不再连开三个对话框
- 根目录也能新建资源（自动落进「未分类」文件夹）
- 按钮去色块：默认白底描边，全局唯一的实心绿只留给主操作

### SVG 画廊（新）

- 当前目录的资源平铺成墙，配**主题色范围**一键切换，验证「跟着主题色一起变」
- 每行列数（自动/2/3/4/6/8）与尺寸（20–96）可调；原色图形按自身长宽比撑满格子
- 文件夹卡片始终排在画廊之上（一个文件夹的内容才铺成画廊）
- 类型标记：双色 / 原色 / ×N（多风格）

### SVG 规范：三档取色 + 自动判档

- `line` 单色图标 / `duotone` 双色（`--accent` 指定主题色，点缀色保留）/ `color` 原色图形
- **默认档改为 `auto`**：动画与插画不再被图标尺子误报（此前会报「viewBox 应为 24×24」等）
- 修线宽判据：内容被 `scale(k)` 包裹时按倍数折算（此前 1.8 实际渲染成 1.35 却报合规）
- 含 `<animate>` / `<script>` 的资源一律归 `color` 档，避免一键归一化改坏动画

### 资源描述

- 新增**资源级主描述**（`<kind> desc`），与风格描述分工：主描述说「这是什么场景」
- 资源页的描述面板：显示模式（只读核对）/ 编辑模式（主描述 + 每个风格一条）
- 搜索纳入描述——`tree --search` 可按描述召回

### 批量导出：浏览器直接下载 zip

- 零依赖 store 模式 ZIP（`core/zip.js`），`GET /api/svg/export.zip` 直接下载
- 仍需导出到指定目录（含自包含看板页）的场景由 CLI 承担

### 面板交互

- 所有分栏改为可拖拽 `SplitPane`：比例持久化、双击复位、**方向键也能调**
  （WCAG 2.2 AA：拖拽不能是唯一方式）
- SVG 资源页：编辑区补保存按钮；左右与右栏上下均可拖；预览随预览区缩放

### 其它

- 新增 `ft-html` skill（A 序列内部工程 / B 序列案例），`ft-svg` 重构为 A/B 序列
- 前端单独开启 `no-undef`：忘 import 直接用会让整页白屏，这类错误现在 lint 就拦下
- 修复：纯路径容器目录无法删除、勾选框点一次选中又被取消、UTF-8 标签乱码入库

## 0.3.0

- SVG 图标集看板与 `ft-svg` 规范 skill
- 分组 + 标签 + 多风格资源库与编辑历史（每风格最近 5 条）
- HTML 渲染沙盒（三编辑框 + 实时预览）与 LOGO 生成
