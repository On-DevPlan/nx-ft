// LOGO 生成域：脚本化产出图片（SVG/PNG/ICO 全套），用于给项目补 LOGO / 挑配色。
// 一条 action 同时声明 CLI 与 HTTP——面板上的每个按钮都有同构命令。
import { openPath } from '../../core/open.js';
import { logosDirFromEnv } from '../../core/paths.js';
import * as gallery from '../../core/logo/gallery.js';
import { logoSvg } from '../../core/logo/gen.js';
import { resolveScheme } from '../../core/logo/schemes.js';

export default {
  id: 'logo',
  title: 'LOGO 生成',
  order: 15,
  actions: [
    {
      id: 'logo.schemes',
      cli: ['logo', 'schemes'],
      http: ['GET', '/api/logo-schemes'],
      summary: '列出全部撞色方案（bg/fg 双色）',
      run: () => {
        const h = gallery.listHistory();
        return { status: 'ok', count: h.schemes.length, defaultScheme: h.defaultScheme, schemes: h.schemes };
      },
      render: (r) =>
        `共 ${r.count} 套撞色方案（默认 ${r.defaultScheme}）\n` +
        r.schemes.map((s) => `  ${s.key.padEnd(10)} ${s.name.padEnd(6)} bg=${s.bg} fg=${s.fg}`).join('\n'),
    },
    {
      id: 'logo.preview',
      cli: ['logo', 'preview'],
      http: ['GET', '/api/logo-preview'],
      summary: '输出 SVG 源码（可重定向保存；面板实时预览同源）',
      args: ['letters'],
      flags: {
        scheme: { type: 'string' },
        bg: { type: 'string', hint: '#RRGGBB' },
        fg: { type: 'string', hint: '#RRGGBB' },
        size: { type: 'number' },
        square: { type: 'boolean' },
      },
      run: (ctx) => {
        const letters = gallery.validateLetters(ctx.letters);
        const theme = resolveScheme(ctx.scheme, { bg: ctx.bg, fg: ctx.fg });
        const svg = logoSvg(letters, theme, {
          size: ctx.size || 512,
          rounded: !ctx.square,
        });
        return { status: 'ok', letters, scheme: theme, svg };
      },
      render: (r) => r.svg,
    },
    {
      id: 'logo.gen',
      cli: ['logo', 'gen'],
      http: ['POST', '/api/logo-gen'],
      summary: '生成全套 LOGO 文件（svg×2 / png×2 / favicon×3 / ico）到目录',
      args: ['letters'],
      flags: {
        scheme: { type: 'string' },
        bg: { type: 'string', hint: '#RRGGBB' },
        fg: { type: 'string', hint: '#RRGGBB' },
        out: { type: 'string', hint: '目标目录' },
        size: { type: 'number' },
        force: { type: 'boolean' },
      },
      run: (ctx) =>
        gallery.generate({
          letters: ctx.letters,
          scheme: ctx.scheme,
          bg: ctx.bg,
          fg: ctx.fg,
          out: ctx.out,
          size: ctx.size,
          force: ctx.force,
        }),
      render: (r) => {
        if (r.status === 'conflict') {
          return (
            `目标目录已有同名文件（${r.existing.join(', ')}）:\n  ${r.dir}\n` +
            '确认覆盖（可能是手工调整过的图）: 加 --force'
          );
        }
        return `${r.note}\n目录: ${r.dir}\n` + r.files.map((f) => '  ' + f).join('\n');
      },
    },
    {
      id: 'logo.history',
      cli: ['logo', 'history'],
      http: ['GET', '/api/logo-history'],
      summary: '列出最近生成记录（含产物目录）',
      run: () => {
        const h = gallery.listHistory();
        return { status: 'ok', dir: h.dir, count: h.records.length, records: h.records };
      },
      render: (r) =>
        r.count
          ? `最近生成 ${r.count} 条（画廊 ${r.dir}）\n` +
            r.records
              .map((x) => `  ${x.letters.padEnd(6)} ${x.schemeName.padEnd(8)} ${x.dir}`)
              .join('\n')
          : `暂无生成记录（画廊 ${r.dir}）`,
    },
    {
      id: 'logo.reveal',
      cli: ['logo', 'reveal'],
      http: ['POST', '/api/logo-reveal'],
      summary: '在文件管理器里打开生成目录（缺省打开画廊）',
      args: [{ name: 'dir', required: false }],
      run: (ctx) => {
        const dir = ctx.dir || logosDirFromEnv();
        openPath(dir); // 平台打开失败静默降级，不抛
        return { status: 'ok', dir };
      },
      render: (r) => `已打开: ${r.dir}`,
    },
  ],
};
