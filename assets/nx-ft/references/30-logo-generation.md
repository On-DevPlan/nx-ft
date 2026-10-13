# 30 · LOGO 生成：命令速查与补旧项目流程

> 本文件是 `SKILL.md` 的配套速查。用脚本产出项目 LOGO 全套（SVG/PNG/ICO），
> 主要用途：给旧项目补 LOGO、为新项目挑配色、批量统一家族视觉。

## 产物（一次生成 8 件，零依赖纯 JS 计算）

| 文件 | 说明 |
| --- | --- |
| `logo.svg` / `logo-rounded.svg` | 矢量主图（方形 / 圆角），任意尺寸清晰，**首选产物** |
| `logo.png` / `logo-rounded.png` | 位图（512），apple-touch-icon 用 |
| `favicon-16.png` / `favicon-32.png` / `favicon-48.png` | 小尺寸 favicon |
| `favicon.ico` | 16/32/48 三合一 ICO 容器 |

⚠️ PNG 走内置 5x7 点阵字模，**只适合 1~5 个字符**；再多请只用 SVG。

## 命令全表（CLI ↔ HTTP 同源）

| 命令 | 用途 | 对应 HTTP |
| --- | --- | --- |
| `logo schemes` | 列出全部撞色方案（14 套） | `GET /api/logo-schemes` |
| `logo preview <字母> [--scheme] [--bg #..] [--fg #..] [--size] [--square]` | 输出 SVG 源码（可重定向保存） | `GET /api/logo-preview` |
| `logo gen <字母> [--scheme] [--bg] [--fg] [--out <目录>] [--size] [--force]` | 生成全套文件 | `POST /api/logo-gen` |
| `logo history` | 最近生成记录（含产物目录） | `GET /api/logo-history` |
| `logo reveal [目录]` | 在文件管理器打开（缺省画廊） | `POST /api/logo-reveal` |

## 两套配色机制

1. **14 套命名撞色方案**（`--scheme`）：klein 克莱因蓝 / mars 马尔斯绿（默认）/
   hermes 爱马仕橙 / tiffany 蒂芙尼蓝 / red 中国红 / vandyke 凡戴克棕 / prussian 普鲁士蓝 /
   ink 墨黑 / gold 黑金 / royal 帝王紫 / forest 森林绿 / ash 雾灰 / lemon 柠檬黄 / coral 珊瑚橘。
   暗底（ink/gold/royal/forest）适合深色项目，亮底（ash/lemon/tiffany）适合浅色项目。
2. **自定义双色**（`--bg` / `--fg`，6 位十六进制）：只给一个时另一个沿用方案色。
   用于严格对齐旧项目的品牌色。

## 补旧项目 LOGO 的标准流程

```bash
# 1. 看旧项目原来用什么颜色（比如从它的 CSS 变量里找），挑最近的方案或直接用自定义色：
node bin/ft.mjs logo preview xx --bg #1E6FD9 --fg #FFFFFF > /tmp/xx.svg   # 先预览

# 2. 直接写进旧项目的静态目录（同名文件存在时会先拒绝，防止覆盖手工图）
node bin/ft.mjs logo gen xx --scheme prussian --out D:/code/old-project/src/web/frontend/public

# 3. 确认要覆盖时加 --force；生成记录可用 logo history 回查
```

## 易错点

1. 字母限 **1~5 位**（字母/数字/`-` `_` `.`），超长会被拒绝——PNG 点阵的物理上限。
2. `--out` 目录已有同名文件时返回 **conflict**（不是错误）：确认覆盖加 `--force`——
   这是防「补 LOGO 时把手工调过的图冲掉」的最后一道闸。
3. 画廊模式（不带 `--out`）按时间戳建目录，永不覆盖；`logo history` 里可取回路径。
4. 面板「LOGO 生成」页与命令完全同源：swatch 选色 = `--scheme`，两个取色器 = `--bg/--fg`，
   「生成全套文件」= `logo gen`；预览就是 `logo preview` 的 SVG。
