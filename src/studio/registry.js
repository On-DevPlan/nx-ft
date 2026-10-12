// 视图注册表：新增面板 = 在模块里写 view.jsx + 在这里登记一行。
// App 的 tab 导航、hash 路由、懒加载全部由这张表驱动，改面板不用动壳。
//
// 与后端 src/runtime/registry.js 的模块表一一对应；
// tests/unit/registry.test.mjs 会断言两侧对齐——漏登记（或登记了不存在的视图）都会直接测试失败。
//
// 组件契约（examples/props/classes）由 catalog 视图就地内联展示，
// 没有二级文档页；views/ComponentDoc.jsx 保留在盘但未登记（上游无 git，
// 留作回滚与「React 绑定交互预览」的参考实现）。
import { lazy } from 'react';

export const VIEWS = [
  { id: 'studio', title: 'Studio', component: lazy(() => import('../modules/studio/view.jsx')) },
  { id: 'catalog', title: '组件目录', component: lazy(() => import('./views/Catalog.jsx')) },
  { id: 'stylelab', title: '风格实验室', component: lazy(() => import('./views/StyleLab.jsx')) },
  { id: 'svg', title: 'SVG 资产', component: lazy(() => import('../modules/svg/view.jsx')) },
];
