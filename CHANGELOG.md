# Changelog

本文件记录对外可见的变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### Added

- 4-pack 风格库：boxed / hairline / sectioned / terminal，各 10 件 strategy css + 4 组件 spec（取代 paper / ledger-offset）
- 多平台注册表 `registry/<platform>/<id>/`：flutter 的 button / tag / card 三件；theme 支持平台级共享 + 组件级覆盖
- 组件目录 TolyUI 化 + 真实 Flutter Web playground（单 playground，postMessage 切换变体）
- Flutter playground 控件条：由 spec.props 驱动（enum 按钮组 / boolean 开关），变体切换引擎零重载
- registry spec 形状一致性测试（目录 ↔ spec ↔ Dart dispatch 对齐，漏登记当场红）

### Fixed

- 服务端 `style` 缺省不再硬编码 pack 名（paper 删除后无参调用 404）——动态取 catalog 首个风格包；未知 pack 名报用法错并列出可用项
- eslint 忽略 Flutter 构建产物（`tools/flutter-showcase/build/`、`.dart_tool/`），本机 `showcase:build` 后 `pnpm test` 不再刷屏
- 面板 pack 选择状态对已删 pack 自愈（ComponentDoc 补齐与 StyleLab 同款校验）

## [0.1.0] - 生成即初始状态

由 [nx-nx](https://github.com/On-DevPlan/nx-nx) 的 `server-cli-web` 模板生成。
此后按 Keep a Changelog 惯例增条目。
