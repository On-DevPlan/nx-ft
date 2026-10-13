// SVG 网盘页：与 html 管理页同一套 ManagePage（面包屑地址 + 内联创建 + 无左树），
// 仅有的差异通过两个口子注入：
//   noun="图标"                —— 文案
//   toolbar={(reload) => 节点}  —— svg 特有的看板动作（导入 / 导出 / 自检 / 归一化），
//                                 这些动作完成后需要刷新列表，所以收 reload 而不是静态节点。
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { useStore } from '../../store.jsx';
import { useBatch } from './batch.jsx';
import { SvgGallery } from './gallery.jsx';
import { ManagePage } from '../asset/manage.jsx';

const enc = encodeURIComponent;
const encPath = (p) => p.split('/').map(enc).join('/');

function SvgBoardActions({ reload }) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node: dlgNode } = useDialog();
  const { boot } = useStore();
  const bin = boot?.app?.name || 'nx-ft';
  // group: '' 让批量动作作用于根（看板全局）；进入分组后由 ManagePage 的 dir 决定作用域
  const batch = useBatch({ bin, dialog, guard, toast, reload, group: '' });

  return (
    <>
      <div className="am-actions">
        <button className="btn small ghost" onClick={() => batch.importDir()}>批量导入</button>
        <button className="btn small ghost" onClick={() => batch.exportDir()}>批量导出</button>
        <button className="btn small ghost" onClick={() => batch.check()}>规范自检</button>
        <button className="btn small ghost" onClick={() => batch.fix()}>一键归一化</button>
      </div>
      {dlgNode}
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
              search={ctx.search}
              activeTags={ctx.activeTags}
              onOpen={ctx.onOpen}
            />
          ),
        },
      ]}
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
