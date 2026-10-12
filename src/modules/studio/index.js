// studio 域：把整套「库 + agent I/O」包装成一个模块。
//
// 为什么是这个形状：family 的约定是「一个模块 = 一组 action」，
// cli/http/help/view 同源派生。studio 是 ui-kit 的「业务域」，
// 它同时承担了 server-cli-web 里 home + settings 两个示例域加起来示范过的事：
//
//   - 读路径   (bootstrap / manifest / packs / component)
//   - 写路径   (build / skill install)
//   - 元数据   (routes / health)
//
// 写新模块请照 index.js 的形状——一条 action 同时声明 cli 与 http，
// 漏任何一侧 registry 自检会当场报错。
import * as service from './service.js';

export default {
  id: 'studio',
  title: 'Studio',
  order: 1,
  actions: [
    // ---- 元数据：与 server-cli-web 的 home 域对齐 ----

    {
      id: 'studio.bootstrap',
      cli: ['bootstrap', 'show'],
      http: ['GET', '/api/bootstrap'],
      summary: '一次取齐面板启动所需的全部上下文（带库元数据）',
      run: () => service.bootstrap(),
    },
    {
      id: 'studio.routes',
      cli: ['routes'],
      http: ['GET', '/api/routes'],
      summary: '列出 CLI 命令与 HTTP 路由的对照表',
      run: async () => {
        const { commandTable } = await import('./commands.js');
        const table = await commandTable();
        return {
          status: 'ok',
          count: table.length,
          routes: table.map((c) => ({
            id: c.id,
            module: c.module,
            cli: c.command,
            http: c.http ? `${c.http.method} ${c.http.path}` : null,
            summary: c.summary,
          })),
        };
      },
      render: (r) => {
        const lines = [`共 ${r.count} 条命令（CLI ↔ HTTP 对照）`, ''];
        const width = Math.max(...r.routes.map((x) => x.cli.length));
        for (const x of r.routes) {
          lines.push('  ' + x.cli.padEnd(width + 2) + (x.http || '(仅 CLI)') + '   ' + (x.summary || ''));
        }
        return lines.join('\n');
      },
    },
    {
      id: 'studio.health',
      cli: ['health'],
      http: ['GET', '/api/health'],
      summary: '自检：组件 / 风格包 / 命令表 / 存储 都能解析',
      run: async () => {
        const { commandTable } = await import('./commands.js');
        const b = await service.bootstrap();
        return {
          status: 'ok',
          app: b.app.name,
          version: b.app.version,
          storePath: b.storePath,
          commands: (await commandTable()).length,
          components: b.library.components,
          styles: b.library.styles,
        };
      },
      render: (r) =>
        `正常 · ${r.app} v${r.version}\n` +
        `命令 ${r.commands} 条 · 组件 ${r.components} 件 · 风格包 ${r.styles} 个\n` +
        `存储: ${r.storePath}`,
    },

    // ---- 库读路径：agent I/O 的核心 ----
    //
    // 三个端点的语义：
    //   manifest   一次性拿全库目录（按需用 ?style= 过滤 css）
    //   packs      只拿风格包清单（不含 css，省流量）
    //   component  单件深读：spec + 该风格下该策略的 css

    {
      id: 'studio.manifest',
      cli: ['studio', 'manifest'],
      http: ['GET', '/api/studio/manifest'],
      summary: '整库目录（components + styles，?style= 过滤 css）',
      flags: {
        style: { type: 'string', hint: '把哪个风格包的 css 嵌入到组件 css 字段里' },
      },
      run: (ctx) => service.manifest({ style: ctx.style }),
      render: (r) => {
        const lines = [`${r.components.length} 个组件 / ${Object.keys(r.styles).length} 个风格包`];
        for (const c of r.components) {
          lines.push(`  [${c.category}] ${c.id}  ${c.title}`);
        }
        return lines.join('\n');
      },
    },
    {
      id: 'studio.packs',
      cli: ['studio', 'packs'],
      http: ['GET', '/api/studio/packs'],
      summary: '列出已安装风格包（name / label / extends / strategies）',
      run: () => service.packs(),
      render: (r) => {
        const list = Object.values(r.packs);
        if (!list.length) return '（无风格包）';
        const width = Math.max(...list.map((p) => p.name.length));
        return list.map((p) => `  ${p.name.padEnd(width + 2)}${p.label}${p.extends ? '   extends ' + p.extends : ''}`).join('\n');
      },
    },
    {
      id: 'studio.component',
      cli: ['studio', 'component'],
      http: ['GET', '/api/studio/component/:id'],
      summary: '单件深读：spec + 该风格下相关策略 css',
      args: [{ name: 'id', required: true }],
      flags: {
        style: { type: 'string', hint: '从哪个风格包加载 css（缺省取 catalog 首个风格包）' },
        tokens: { type: 'string', default: 'light', hint: '从哪个 palette 轴加载 tokens.css（默认 light）' },
        withJsx: { type: 'boolean', default: false, hint: '同时把 React 绑定源码带回来' },
      },
      run: (ctx) => service.component({ id: ctx.id, style: ctx.style, withJsx: ctx.withJsx, tokens: ctx.tokens }),
    },
    {
      id: 'studio.preview',
      cli: ['studio', 'preview'],
      http: ['GET', '/api/studio/preview/:id'],
      summary: '渲染组件 HTML（class 契约 + 示例填参）',
      args: [{ name: 'id', required: true }],
      flags: {
        style: { type: 'string' },
        tokens: { type: 'string', default: 'light' },
      },
      run: (ctx) => service.preview({ id: ctx.id, style: ctx.style, tokens: ctx.tokens }),
    },

    // ---- 库写路径 ----

    {
      id: 'studio.build',
      cli: ['studio', 'build'],
      http: ['POST', '/api/studio/build'],
      summary: '从 spec 重建 catalog.json',
      run: () => service.build(),
      render: (r) => `已写入: ${r.path}（${r.components} 个组件 / ${r.styles} 个风格包）`,
    },
    {
      id: 'studio.doctor',
      cli: ['studio', 'doctor'],
      http: ['GET', '/api/studio/doctor'],
      summary: '一致性自检：spec ↔ css ↔ catalog',
      run: () => service.doctor(),
      render: (r) => {
        if (r.issues.length === 0) return `正常 · ${r.components} 个组件 / ${r.styles} 个风格包 · 无问题`;
        return `发现 ${r.issues.length} 个问题:\n` + r.issues.map((i) => `  · ${i}`).join('\n');
      },
    },

    // ---- 平台命令：skill install / get ----

    {
      id: 'studio.skillInstall',
      cli: ['skill', 'install'],
      http: ['POST', '/api/skill/install'],
      summary: '把随包 skill 装到 ~/.claude/skills（让本机 agent 学会用法）',
      flags: {
        name: { type: 'string' },
        to: { type: 'string' },
        force: { type: 'boolean' },
      },
      run: async (ctx) => {
        const { installBundledSkill } = await import('../../runtime/skill.js');
        return installBundledSkill({ name: ctx.name, to: ctx.to, force: ctx.force });
      },
      render: (r) => {
        if (r.skipped) return `已是最新: ${r.path}`;
        if (r.status === 'conflict')
          return `冲突: ${r.path}（${r.count} 个文件不同；确认覆盖加 --force）`;
        return `${r.replaced ? '已替换' : '已安装'}: ${r.path}（${r.files} 个文件）`;
      },
    },
    {
      id: 'studio.skillGet',
      cli: ['skill', 'get'],
      http: null,
      summary: '导出 skill 上下文（prefix + 文档 + install 状态）',
      args: [{ name: 'ref', required: false }],
      flags: { name: { type: 'string' }, to: { type: 'string' }, force: { type: 'boolean' } },
      run: async (ctx) => {
        const { getSkill } = await import('../../runtime/skill.js');
        return getSkill({ ref: ctx.ref, name: ctx.name, to: ctx.to, force: ctx.force });
      },
      render: async (r) => {
        const { skillGetPrefix, skillGetInstallStatus } = await import('../../runtime/skill.js');
        return [
          skillGetPrefix(r.skillName, r.ref),
          r.content,
          '',
          skillGetInstallStatus(r.install),
        ].join('\n');
      },
    },
  ],
};
