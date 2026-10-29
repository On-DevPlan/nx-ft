// skill 域：管理随包分发的多 skill（主 skill 与可选配套 skill）。
// 平台级能力，action 只做 I/O 编排；发现/分组/安装/导出的真相在 core/skills/。
import * as skills from '../../core/skills/index.js';
import * as skillsGet from '../../core/skills/get.js';
import { badInput } from '../../core/errors/index.js';

export default {
  id: 'skill',
  title: 'Skill',
  order: 20,
  actions: [
    {
      id: 'skill.list',
      cli: ['skill', 'list'],
      http: ['GET', '/api/skills'],
      summary: '列出可装的 skill 与 group',
      run: async () => {
        const [names, manifest] = await Promise.all([
          skills.bundledSkillNames(),
          skills.loadGroups(),
        ]);
        return {
          skills: names,
          groups: Object.keys(manifest.groups),
          defaultGroup: manifest.defaultGroup,
          source: manifest.source,
        };
      },
      render: (r) => {
        const lines = ['可装的 skill:'];
        for (const n of r.skills) {
          lines.push('  ' + n + (n === r.defaultGroup ? '  （默认 install）' : ''));
        }
        lines.push('可装的 group:');
        for (const g of r.groups) {
          lines.push('  ' + g + (g === r.defaultGroup ? '  （默认）' : ''));
        }
        return lines.join('\n');
      },
    },
    {
      id: 'skill.groups',
      cli: ['skill', 'groups'],
      http: ['GET', '/api/skill-groups'],
      summary: '列出每个 group 含哪些 skill',
      run: async () => {
        const manifest = await skills.loadGroups();
        return { source: manifest.source, groups: manifest.groups, warning: manifest.warning };
      },
      render: (r) => {
        const lines = [];
        for (const [key, g] of Object.entries(r.groups)) {
          lines.push(
            `  ${key.padEnd(12)} [${g.skills.join(', ')}]${g.summary ? '  ' + g.summary : ''}`
          );
        }
        if (r.warning) lines.push('', '警告: ' + r.warning);
        return `group 清单（来源: ${r.source}）\n` + lines.join('\n');
      },
    },
    {
      id: 'skill.get',
      cli: ['skill', 'get'],
      http: ['GET', '/api/skill-content'],
      summary: '导出 skill 文档（并幂等安装）',
      args: [
        { name: 'name', required: false },
        { name: 'ref', required: false },
      ],
      flags: {
        to: { type: 'string' },
        force: { type: 'boolean' },
      },
      run: async (ctx) => {
        const result = await skillsGet.getSkill(ctx.name || 'nx-ft', {
          ref: ctx.ref,
          to: ctx.to,
          force: ctx.force,
        });
        return {
          skillName: result.skillName,
          ref: result.ref,
          contentBytes: result.contentBytes,
          prefix: skillsGet.skillGetPrefix(result.skillName, result.ref),
          content: result.content,
          installStatus: skillsGet.installStatusLine(result.install),
        };
      },
      // 人读模式：前缀 → 全文 → 安装状态，三段拼接。
      render: (r) => [r.prefix, r.content, '', r.installStatus].join('\n'),
    },
    {
      id: 'skill.install',
      cli: ['skill', 'install'],
      http: ['POST', '/api/skill-install'],
      summary: '安装 skill（单个 / 整组 / --all 全部）',
      args: [{ name: 'name', required: false }],
      flags: {
        all: { type: 'boolean' },
        group: { type: 'string' },
        to: { type: 'string' },
        force: { type: 'boolean' },
      },
      run: async (ctx) => {
        const opts = { to: ctx.to, force: ctx.force };
        // 三种选法互斥：点名一个、一个 group、全部
        const picked = [!!ctx.name, !!ctx.group, !!ctx.all].filter(Boolean).length;
        if (picked > 1) {
          throw badInput('位置参数 name、--group、--all 三者互斥，只能给一个');
        }
        if (ctx.all) return skills.installAll(opts);
        if (ctx.group) return skills.installGroup(ctx.group, opts);
        return skills.installOne(ctx.name || 'nx-ft', opts);
      },
      render: (r) => {
        // 多 skill 结果（group / all）：label 说清是「哪一批」，冲突语义完全一致
        if (Array.isArray(r.skills)) {
          const label = r.all ? '全部 skill' : `group ${r.group}`;
          if (r.status === 'conflict') {
            return (
              `${label} 有冲突（未安装任何文件）:\n` +
              r.skills.map((x) => `  冲突: ${x.path}（${x.files} 个文件不同）`).join('\n') +
              '\n确认覆盖: 加 --force'
            );
          }
          return (
            `${label} 已安装:\n` +
            r.skills
              .map((x) => `  ${x.status === 'skipped' ? '已是最新' : '已安装'}: ${x.path}`)
              .join('\n')
          );
        }
        const x = r;
        if (x.status === 'conflict') {
          return `冲突: ${x.path}（${x.files} 个文件不同）；确认覆盖加 --force`;
        }
        if (x.status === 'skipped') return `已是最新: ${x.path}`;
        return `${x.replaced ? '已替换' : '已安装'}: ${x.path}（${x.files} 个文件）`;
      },
    },
  ],
};
