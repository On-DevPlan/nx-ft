// SVG 网盘页：与 html 管理页同一套 ManagePage（面包屑地址 + 内联创建 + 无左树），
// 仅有的差异通过两个口子注入：
//   noun="图标"                —— 文案
//   toolbar={(reload) => 节点}  —— svg 特有的看板动作（导入 / 导出 / 自检 / 归一化），
//                                 这些动作完成后需要刷新列表，所以收 reload 而不是静态节点。
import { createPortal } from 'react-dom';
import { Btn } from '../btn/index.jsx';
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { useBatch } from './batch.jsx';
import { SvgGallery } from './gallery.jsx';
import { SvgZipIoBtns } from './zip-io.jsx';
import { ManagePage } from '../asset/manage.jsx';

const enc = encodeURIComponent;
const encPath = (p) => p.split('/').map(enc).join('/');

function SvgBoardActions({ reload }) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node: dlgNode } = useDialog();
  // 规范自检 / 一键归一化走本域 useBatch；导入 / 导出走 exportBtn / importBtn 通道
  // （避免与本组件 SvgZipIoBtns side='both' 重复渲染——面板已把导入/导出独立配显隐/快捷）
  const batch = useBatch({ dialog, guard, toast, reload });

  return (
    <>
      <Btn size="sm" variant="secondary" onClick={() => batch.check()}>规范自检</Btn>
      <Btn size="sm" variant="secondary" onClick={() => batch.fix()}>一键归一化</Btn>
      {createPortal(dlgNode, document.body)}
    </>
  );
}

export function SvgDrive({ path = '' }) {
  return (
    <ManagePage
      kind="svg"
      noun="图标"
      initialDir={path}
      defaultViewLabel="编辑"
      // 画廊模式：图标平铺成墙 + 主题色范围，验证「跟着主题色变」的效果
      views={[
        {
          id: 'gallery',
          label: '画廊',
          render: (ctx) => (
            <SvgGallery
              dir={ctx.dir}
              dirNode={ctx.dirNode}
              search={ctx.search}
              activeTags={ctx.activeTags}
              onOpen={ctx.onOpen}
              pickDir={ctx.pickDir}
              // 批量勾选 ctx（manage.jsx 提供了，之前漏转发 → 画廊里批量模式勾不了）
              batchMode={ctx.batchMode}
              selected={ctx.selected}
              selectedDirs={ctx.selectedDirs}
              onToggle={ctx.onToggle}
              onToggleDir={ctx.onToggleDir}
              tree={ctx.tree}
            />
          ),
        },
      ]}
      // 1.1 起：导出 / 导入拆成单边按钮节点（与 html 域 AssetView 同样姿势），
      // 让面板的「快捷显示」开关能落到 svg 工具栏上；svg strategy 不同（SvgZipIoBtns），
      // 由 SvgDrive 负责按 side 拆。
      exportBtn={<SvgZipIoBtns group={path} side="export" />}
      importBtn={<SvgZipIoBtns group={path} side="import" />}
      toolbar={(reload) => <SvgBoardActions reload={reload} />}
      onNavigate={(dir) => {
        location.hash = dir ? `#/svg/dir/${encPath(dir)}` : '#/svg';
      }}
      onOpen={(group, name) => {
        location.hash = `#/svg/edit/${encPath(group)}/${enc(name)}`;
      }}
    />
  );
}
