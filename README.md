# nx-se

多风格 UI 组件库 + agent-facing studio

```bash
pnpm install
pnpm dev    # vite + studio serve，一个 ctrl-c 一起退
```

## 它是什么

**npm 包 + 本地 Studio。** 一套多风格 UI 组件库，对外发布为 npm，对内自带 Studio
让 agent 与开发者能浏览组件、切风格包、读 / 写 spec、生成自包含 HTML 片段。

| | |
| --- | --- |
| **CLI 命令表** | `nx-se help`（或 `routes` 看命令 ↔ 路由对照） |
| **Web 面板** | `pnpm dev` 后打开 `http://127.0.0.1:7881` |
| **Agent I/O** | `GET /api/studio/manifest`（机器可读清单） · `GET /api/studio/component/:id`（单件深读） · `GET /api/studio/preview/:id`（HTML 片段） |
| **离线通道** | `nx-se skill install` → `~/.claude/skills/<name>/` |
| **数据** | `~/.nx-se/store.json`（环境变量 `NX_SE_STORE` 覆盖） |
| **自检** | `nx-se health` · `nx-se studio doctor` |

## 结构

```
src/
├─ styles/                 「一种风格 = 一套组件」——每 pack 自治
│  ├─ paper/
│  │  ├─ pack.json         name / label / extends / strategies
│  │  ├─ btn.css · tag.css · card.css · …   10 件 strategy css
│  │  └─ components/       该 pack 拥有的 React 绑定 + spec
│  │     ├─ btn.jsx + btn.spec.json
│  │     └─ …
│  └─ ledger-offset/       extends paper；只覆盖要变的
│     ├─ pack.json
│     ├─ btn.css           ← 4px 硬偏移演示
│     ├─ tokens.css        ← 想覆盖 palette 默认值时放在这
│     └─ components/       不覆盖则继承自 paper（spec 是单一真相源）
├─ tokens/                 palette 轴：light / dark / warm / mono（CSS 变量层）
├─ layout/                 layout 原语：shell / sidebar / topbar / grid（CSS-only 契约）
├─ manifest/
│  ├─ build.mjs            从 spec 重建 catalog.json（多包聚合）
│  └─ catalog.json         agent 离线摸底的真相快照（每个组件带 pack 字段）
├─ modules/studio/    CLI + HTTP + 面板三端同源的 action 域
│  ├─ index.js        声明 manifest / packs / component / preview / build / doctor / skill
│  ├─ service.js      业务真相源：catalog 聚合、extends 链解析、HTML 渲染
│  └─ view.jsx        面板「Studio」tab
├─ studio/            面板壳（vite 构建，产物被零依赖 node:http 服务）
│  ├─ views/{Catalog,ComponentDoc,StyleLab}.jsx
│  ├─ components/ui.jsx · store.jsx · registry.js · main.jsx · style.css
│  └─ App.jsx · layout.css
├─ core/              基础设施：paths / store / errors / open
└─ runtime/           装配：registry / cli / api / server / spec / skill
```

模块之间禁止互相依赖（eslint 枚举式禁列 + 一致性测试强制），共享逻辑下沉 `core/`。

## 三个轴正交 = 多种 UI 风格

```
4 palette × N packs × 每 pack 自治的 components = M 外观
```

调 `src/tokens/<axis>.css`（palette） + `src/styles/<pack>/`（每个 pack 一套组件与 css），
同一个 `id` 在不同 pack 下是不同的 spec/实现（看 spec.props 而非 class 名是否兼容）——这
就是「每种风格都是一套的」的实际含义。

## 开发

```bash
pnpm dev          # vite + serve 双进程，一个 ctrl-c 一起退
pnpm test         # lint + build + smoke + unit（含 manifest 一致性测试）
pnpm studio build # 手动重建 catalog.json（spec 改了之后）
pnpm logo         # 手动重出 logo（svg + png + ico 全套）
```

## 发版

家族 release 流水线（`.github/workflows/npm-publish.yml`）：推 tag 到 main，
CI 自动构建、测试、`npm publish --provenance`（需要 `NPM_TOKEN` secret）。

## 给 agent 用

```bash
# 把库的契约与用法装给本机 agent（离线）
nx-se skill install

# 在线拿清单（一个请求摸清整库）
curl http://127.0.0.1:7881/api/studio/manifest?style=paper | jq

# 单件深读（spec + css）
curl "http://127.0.0.1:7881/api/studio/component/btn?style=paper&withJsx=1" | jq

# 渲染 HTML 片段（自包含，可直接粘贴）
curl "http://127.0.0.1:7881/api/studio/preview/btn?style=paper" | jq -r .document
```
