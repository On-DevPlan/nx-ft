// action 工厂：html / svg 两个模块的 action 表由同一份代码按 kind 生成。
//
// 每个功能域一条声明，同时给出 cli 路径与 http 路由——「Web 上能做的 CLI 都能做」
// 由此成为结构事实。两个模块的差异只有：命令前缀（html|svg）与 URL 前缀。
import { APP_NAME } from '../paths.js';
import { badInput } from '../errors/index.js';
import { ASSET_KINDS } from './constants.js';
import { codeFlags, collectFiles } from './code-input.js';
import * as groups from './groups.js';
import * as assets from './assets.js';
import * as styles from './styles.js';
import * as renders from './renders.js';

export function makeActions(kind) {
  const K = kind.toUpperCase();
  const A = (parts) => '/api/' + kind + (parts ? '/' + parts : '');
  return [
    {
      id: kind + '.tree',
      cli: [kind, 'tree'],
      http: ['GET', A('tree')],
      summary: `列出 ${K} 分组与资源（--search 关键词，--tags 多标签 AND 筛选）`,
      flags: {
        search: { type: 'string', hint: '关键词' },
        tags: { type: 'array', hint: 'a,b' },
      },
      run: (ctx) => groups.listTree(kind, { search: ctx.search, tags: ctx.tags }),
      render: (r) => renders.renderTree(r, kind),
    },
    {
      id: kind + '.group.add',
      cli: [kind, 'group', 'add'],
      http: ['POST', A('groups')],
      summary: '创建分组（1~8 段路径，支持多层，如 ui/buttons/primary）',
      args: ['group'],
      flags: { label: { type: 'string' } },
      run: (ctx) => groups.addGroup({ kind, group: ctx.group, label: ctx.label }),
      render: (r) =>
        r.status === 'skipped' ? `分组已存在: ${r.path}` : `已创建分组: ${r.path}（${r.label}）`,
    },
    {
      id: kind + '.group.reorder',
      cli: [kind, 'group', 'reorder'],
      http: ['POST', A('groups-reorder')],
      summary: '调整同级分组顺序（--order 给出该层级全部子分组的新顺序）',
      flags: {
        parent: { type: 'string', hint: '父分组；缺省 = 最外层' },
        order: { type: 'array', required: true, hint: '完整新顺序，如 ui,a,b' },
      },
      run: (ctx) => groups.reorderSiblings({ kind, parent: ctx.parent || '', order: ctx.order }),
      render: (r) => `已调整同级顺序: ${r.parent} → ${r.order.join(' · ')}`,
    },
    {
      // 在系统文件管理器里打开：路径由后端按 kind/group(/name) 解析（见 groups.revealDir），
      // 前端不传绝对路径——面板与 CLI 同机，spawn 由 core/open.js 负责，失败静默降级。
      id: kind + '.reveal',
      cli: [kind, 'reveal'],
      http: ['POST', A('reveal')],
      summary: '在文件管理器中打开分组目录（不带 group = 本域根目录；给了 --name 则打开该资源的目录）',
      args: [{ name: 'group', required: false }],
      flags: { name: { type: 'string', hint: '资源名；给了就打开该资源的目录' } },
      run: (ctx) => groups.revealDir({ kind, group: ctx.group, name: ctx.name }),
      render: (r) => `已在文件管理器中打开: ${r.path}`,
    },
    {
      id: kind + '.group.rename',
      cli: [kind, 'group', 'rename'],
      http: ['POST', A('groups-rename')],
      summary: '分组改名 / 移动（--to 新路径；只改展示名可省略 --to）',
      args: ['group'],
      flags: {
        to: { type: 'string', hint: '新路径，如 ui/icons/nav' },
        label: { type: 'string', hint: '展示名' },
      },
      run: (ctx) =>
        groups.renameGroup({ kind, group: ctx.group, to: ctx.to || ctx.group, label: ctx.label }),
      render: (r) =>
        r.status === 'blocked'
          ? `拒绝改名: ${r.path} —— ${r.reason}`
          : r.renamed
            ? `已改名/移动: → ${r.path}（${r.label}）`
            : `已更新展示名: ${r.path}（${r.label}）`,
    },
    {
      id: kind + '.group.rm',
      cli: [kind, 'group', 'rm'],
      http: ['POST', A('groups-remove')],
      summary: '删除分组（非空需 --force）',
      args: ['group'],
      flags: { force: { type: 'boolean' } },
      run: (ctx) => groups.removeGroup({ kind, group: ctx.group, force: ctx.force }),
      render: (r) =>
        r.status === 'blocked'
          ? `拒绝删除: ${r.path} —— ${r.reason}`
          : `已删除分组: ${r.path}（含 ${r.removed.assets} 个资源 / ${r.removed.groups} 个子分组）`,
    },
    {
      id: kind + '.add',
      cli: [kind, 'add'],
      http: ['POST', A('assets')],
      summary: '新建资源（一个场景，如「登录按钮」；--tags 打标签便于检索）',
      args: ['group', 'name'],
      flags: {
        label: { type: 'string' },
        style: { type: 'string' },
        tags: { type: 'array', hint: 'button,login' },
        ...codeFlags(kind),
      },
      run: (ctx) =>
        assets.createAsset({
          kind,
          group: ctx.group,
          name: ctx.name,
          label: ctx.label,
          tags: ctx.tags,
          style: ctx.style,
          code: Object.keys(collectFiles(ctx, kind)).length ? collectFiles(ctx, kind) : undefined,
        }),
      render: (r) => {
        if (r.status === 'skipped') return `资源已存在: ${r.group}/${r.name}`;
        const style = r.style && r.style.startsWith('ok:') ? r.style.slice(3) : null;
        return `已创建资源: ${r.group}/${r.name}` + (style ? `（含风格 ${style}）` : '');
      },
    },
    {
      id: kind + '.load',
      cli: [kind, 'load'],
      http: ['GET', A('asset')],
      summary: '读取资源详情（含标签、风格与历史清单）',
      args: ['group', 'name'],
      flags: { 'no-code': { type: 'boolean' } },
      run: (ctx) =>
        assets.loadAsset({ kind, group: ctx.group, name: ctx.name, code: !ctx['no-code'] }),
      render: (r) => renders.renderLoad(r, APP_NAME),
    },
    {
      id: kind + '.put',
      cli: [kind, 'put'],
      http: ['POST', A('asset-code')],
      summary: '保存风格代码（每次保存把改动前推入历史）',
      args: ['group', 'name'],
      flags: { style: { type: 'string', required: true }, ...codeFlags(kind) },
      run: (ctx) =>
        styles.saveCode({
          kind,
          group: ctx.group,
          name: ctx.name,
          style: ctx.style,
          files: collectFiles(ctx, kind),
        }),
      render: (r) =>
        r.status === 'skipped'
          ? `无变化: ${r.group}/${r.name}@${r.style}`
          : `已保存: ${r.group}/${r.name}@${r.style}（${r.changed.join(', ')}；历史 ${r.historyCount} 条）`,
    },
    {
      id: kind + '.rename',
      cli: [kind, 'rename'],
      http: ['POST', A('asset-rename')],
      summary: '资源改名：--label 改展示名，--to 改目录名（至少给一个；改目录名不动内容与历史）',
      args: ['group', 'name'],
      flags: {
        label: { type: 'string', hint: '展示名' },
        to: { type: 'string', hint: '新目录名，如 arrow-up' },
      },
      run: (ctx) => {
        if (ctx.label === undefined && ctx.to === undefined) {
          throw badInput('至少给一个：--label（展示名）或 --to（目录名）');
        }
        return assets.renameAsset({
          kind,
          group: ctx.group,
          name: ctx.name,
          label: ctx.label,
          to: ctx.to,
        });
      },
      render: (r) =>
        r.status === 'blocked'
          ? `拒绝改名: ${r.group}/${r.name} —— ${r.reason}`
          : r.renamed
            ? `已改名: ${r.group}/${r.name}（目录名已改，展示名 ${r.label}）`
            : `已改展示名: ${r.group}/${r.name} → ${r.label}`,
    },
    {
      id: kind + '.asset.reorder',
      cli: [kind, 'asset', 'reorder'],
      http: ['POST', A('asset-reorder')],
      summary: '调整同组资源顺序（--order 给出该组全部资源名的新顺序；根层资源在「未分类」）',
      flags: {
        group: { type: 'string', hint: '分组路径；缺省 = 未分类（根层资源）' },
        order: { type: 'array', required: true, hint: '完整新顺序，如 a,b,c' },
      },
      run: (ctx) =>
        assets.reorderAssets({ kind, group: ctx.group || '未分类', order: ctx.order }),
      render: (r) => `已调整资源顺序: ${r.group} → ${r.order.join(' · ')}`,
    },
    {
      id: kind + '.desc',
      cli: [kind, 'desc'],
      http: ['POST', A('asset-desc')],
      summary: '给资源写「主描述」（一句话说清这是什么场景；区别于每个风格的 --desc）',
      args: ['group', 'name'],
      flags: { text: { type: 'string', required: true, hint: '留空串即清除' } },
      run: (ctx) =>
        assets.setAssetDesc({ kind, group: ctx.group, name: ctx.name, desc: ctx.text }),
      render: (r) =>
        r.desc
          ? `已更新主描述: ${r.group}/${r.name} → ${r.desc}`
          : `已清除主描述: ${r.group}/${r.name}`,
    },
    {
      id: kind + '.tag.add',
      cli: [kind, 'tag', 'add'],
      http: ['POST', A('tags-add')],
      summary: '给资源加标签（多个用逗号分隔；用于检索与筛选）',
      args: ['group', 'name'],
      flags: { tags: { type: 'array', required: true, hint: 'button,login' } },
      run: (ctx) => assets.addTags({ kind, group: ctx.group, name: ctx.name, tags: ctx.tags }),
      render: (r) =>
        r.status === 'skipped'
          ? `标签已存在: [${renders.fmtTags(r.tags)}]`
          : `已加标签: ${r.added.map((t) => '#' + t).join(' ')} → [${renders.fmtTags(r.tags)}]`,
    },
    {
      id: kind + '.tag.rm',
      cli: [kind, 'tag', 'rm'],
      http: ['POST', A('tags-remove')],
      summary: '移除资源标签',
      args: ['group', 'name'],
      flags: { tags: { type: 'array', required: true, hint: 'button,login' } },
      run: (ctx) => assets.removeTags({ kind, group: ctx.group, name: ctx.name, tags: ctx.tags }),
      render: (r) =>
        r.status === 'skipped'
          ? `标签不存在: [${renders.fmtTags(r.tags)}]`
          : `已移除: ${r.removed.map((t) => '#' + t).join(' ')} → [${renders.fmtTags(r.tags)}]`,
    },
    {
      id: kind + '.move',
      cli: [kind, 'move'],
      http: ['POST', A('asset-move')],
      summary: '移动资源到别的分组（风格与历史随资源一起搬；目标分组不存在会报错）',
      args: ['group', 'name'],
      flags: { to: { type: 'string', required: true, hint: '目标分组' } },
      run: (ctx) => assets.moveAsset({ kind, from: ctx.group, name: ctx.name, to: ctx.to }),
      render: (r) =>
        r.status === 'blocked'
          ? `拒绝移动: ${r.from}/${r.name} —— ${r.reason}`
          : r.status === 'skipped'
            ? `原地不动: ${r.from}/${r.name}`
            : `已移动: ${r.from}/${r.name} → ${r.to}`,
    },
    {
      id: kind + '.rm',
      cli: [kind, 'rm'],
      http: ['POST', A('asset-remove')],
      summary: '删除资源（含风格需 --force）',
      args: ['group', 'name'],
      flags: { force: { type: 'boolean' } },
      run: (ctx) => assets.removeAsset({ kind, group: ctx.group, name: ctx.name, force: ctx.force }),
      render: (r) =>
        r.status === 'blocked'
          ? `拒绝删除: ${r.group}/${r.name} —— ${r.reason}`
          : `已删除资源: ${r.group}/${r.name}（含 ${r.removed.styles} 个风格）`,
    },
    {
      id: kind + '.style.add',
      cli: [kind, 'style', 'add'],
      http: ['POST', A('styles')],
      summary: '新增风格（不限数量；--copy-from 复制现有风格，--desc 描述特征）',
      args: ['group', 'name', 'style'],
      flags: { 'copy-from': { type: 'string' }, desc: { type: 'string', hint: '一句话特征' }, ...codeFlags(kind) },
      run: (ctx) =>
        styles.addStyle({
          kind,
          group: ctx.group,
          name: ctx.name,
          style: ctx.style,
          copyFrom: ctx['copy-from'],
          desc: ctx.desc,
          code: Object.keys(collectFiles(ctx, kind)).length ? collectFiles(ctx, kind) : undefined,
        }),
      render: (r) =>
        r.status === 'skipped'
          ? `风格已存在: ${r.style}`
          : `已新增风格: ${r.group}/${r.name}@${r.style}` + (r.from ? `（复制自 ${r.from}）` : ''),
    },
    {
      id: kind + '.style.switch',
      cli: [kind, 'style', 'switch'],
      http: ['POST', A('style-active')],
      summary: '切换当前风格（面板默认预览它）',
      args: ['group', 'name', 'style'],
      run: (ctx) => styles.setActiveStyle({ kind, group: ctx.group, name: ctx.name, style: ctx.style }),
      render: (r) => `当前风格: ${r.group}/${r.name}@${r.activeStyle}`,
    },
    {
      id: kind + '.style.desc',
      cli: [kind, 'style', 'desc'],
      http: ['POST', A('style-desc')],
      summary: '设置风格描述（说明这套实现的特征；--text 传空串即清除）',
      args: ['group', 'name', 'style'],
      flags: { text: { type: 'string', required: true, hint: '描述|' } },
      run: (ctx) =>
        styles.setStyleDesc({ kind, group: ctx.group, name: ctx.name, style: ctx.style, text: ctx.text }),
      render: (r) => `已更新描述: ${r.style} → ${r.desc || '(已清除)'}`,
    },
    {
      id: kind + '.style.rm',
      cli: [kind, 'style', 'rm'],
      http: ['POST', A('style-remove')],
      summary: '删除风格（连同其编辑历史）',
      args: ['group', 'name', 'style'],
      run: (ctx) => styles.removeStyle({ kind, group: ctx.group, name: ctx.name, style: ctx.style }),
      render: (r) => `已删除风格: ${r.style}（当前: ${r.activeStyle || '无'}）`,
    },
    {
      id: kind + '.history.list',
      cli: [kind, 'history', 'list'],
      http: ['GET', A('history')],
      summary: `列出风格的编辑历史（最近 ${'5'} 条）`,
      args: ['group', 'name', 'style'],
      run: (ctx) => styles.listHistory({ kind, group: ctx.group, name: ctx.name, style: ctx.style }),
      render: (r) =>
        r.history.length
          ? `${r.group}/${r.name}@${r.style} 编辑历史（保留最近 ${r.keep} 条）\n` +
            r.history.map((h) => `  ${h.id}  ${h.at}`).join('\n')
          : '暂无历史（每次保存自动生成）',
    },
    {
      id: kind + '.history.read',
      cli: [kind, 'history', 'read'],
      http: ['GET', A('history-entry')],
      summary: '读取某条历史快照的代码',
      args: ['group', 'name', 'style'],
      flags: { entry: { type: 'string', required: true } },
      run: (ctx) =>
        styles.readHistory({ kind, group: ctx.group, name: ctx.name, style: ctx.style, entry: ctx.entry }),
      render: (r) => `历史快照 ${r.entry}（${r.at}）\n` + JSON.stringify(r.code, null, 2),
    },
    {
      id: kind + '.history.restore',
      cli: [kind, 'history', 'restore'],
      http: ['POST', A('history-restore')],
      summary: '恢复历史快照到当前（当前状态会再入历史）',
      args: ['group', 'name', 'style'],
      flags: { entry: { type: 'string', required: true } },
      run: (ctx) =>
        styles.restoreHistory({ kind, group: ctx.group, name: ctx.name, style: ctx.style, entry: ctx.entry }),
      render: (r) => `已恢复: ${r.group}/${r.name}@${r.style} ← ${r.restored}（历史 ${r.historyCount} 条）`,
    },
  ];
}

// extraActions 给「在共用 CRUD 之上还有专属能力」的类型用（当前只有 svg：
// 看板 / 批量导入导出 / 规范审计）。html 不传，因此两个模块的共用部分保持逐条同构。
export function makeModule(kind, order, extraActions = []) {
  return {
    id: kind,
    title: ASSET_KINDS[kind].label,
    order,
    actions: [...makeActions(kind), ...extraActions],
  };
}
