// 视图注册表：新增面板 = 在模块里写 view.jsx + 在这里登记一行。
// App 的 tab 导航、hash 路由、懒加载全部由这张表驱动，改面板不用动壳。
//
// 条目可选带 sidebar（同样是懒加载入口，写在各模块的 side.jsx）：
//   有 sidebar = 布局 mode a（左栏目录树）  没有 = mode b（全宽）
// App 的 <Layout> 只按「有没有 sidebar」决定模式，不再另设一份 mode 配置。
//
// 与后端 src/runtime/registry.js 的模块表一一对应；
// tests/unit/registry.test.mjs 会断言两侧对齐——漏登记（或登记了不存在的视图）都会直接测试失败。
import { lazy } from 'react';

export const VIEWS = [
  { id: 'home', title: '首页', component: lazy(() => import('../../modules/home/view.jsx')) },
  {
    id: 'html',
    title: 'HTML 资源',
    component: lazy(() => import('../../modules/html/view.jsx')),
    sidebar: lazy(() => import('../../modules/html/side.jsx')),
  },
  {
    id: 'svg',
    title: 'SVG 资源',
    component: lazy(() => import('../../modules/svg/view.jsx')),
    sidebar: lazy(() => import('../../modules/svg/side.jsx')),
  },
  { id: 'logo', title: 'LOGO 生成', component: lazy(() => import('../../modules/logo/view.jsx')) },
];
