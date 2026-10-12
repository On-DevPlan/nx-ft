// svg 域：矢量审美资产（图标 / 装饰 / 插画）的检索引入口。
//
// 一个模块 = 一组 action；cli/http/help/view 同源派生。
// svg 域只读不写（资产走文件系统，修改靠编辑器），对外只暴露 4 个读路径：
//   list    整库清单（所有组）
//   get     单组 spec（含 items）
//   preview 单件：SVG 原文 + 自包含 HTML 文档
//   build   CLI-only：从 spec 重建 catalog（已包含在 studio build 链路里）
import * as service from './service.js';

export default {
  id: 'svg',
  title: 'SVG 资产',
  order: 2,
  actions: [
    {
      id: 'svg.manifest',
      cli: ['svg', 'list'],
      http: ['GET', '/api/svg/manifest'],
      summary: 'SVG 资产组清单（每组只列 id / title / viewBox / items 数）',
      run: () => service.manifest(),
      render: (r) => {
        if (!r.groups.length) return '（无 SVG 资产——在 src/svg/ 下加一组试试）';
        const lines = [`${r.groups.length} 组 SVG 资产：`, ''];
        for (const g of r.groups) {
          lines.push(`  [${g.id}] ${g.title}  ·  ${g.items.length} 件  ·  viewBox=${g.viewBox || '-'}`);
        }
        return lines.join('\n');
      },
    },
    {
      id: 'svg.group',
      cli: ['svg', 'get'],
      http: ['GET', '/api/svg/group/:group'],
      summary: '单组详情：spec + items 完整清单',
      args: [{ name: 'group', required: true }],
      run: (ctx) => service.group({ id: ctx.group }),
    },
    {
      id: 'svg.preview',
      cli: ['svg', 'preview'],
      http: ['GET', '/api/svg/preview/:group/:item'],
      summary: '单件：SVG 原文 + 自包含 HTML 文档（无浏览器依赖）',
      args: [
        { name: 'group', required: true },
        { name: 'item', required: true },
      ],
      run: (ctx) => service.preview({ groupId: ctx.group, itemId: ctx.item }),
    },
    {
      id: 'svg.build',
      cli: ['svg', 'build'],
      http: null,
      summary: '从 spec 重建 catalog（已包含在 `studio build` 链路里）',
      run: () => service.build(),
      render: (r) => `已写入: ${r.path}（svg ${r.svg} 组）`,
    },
  ],
};
