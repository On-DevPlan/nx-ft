// SVG 网盘页：与 html 管理页同一套 ManagePage（面包屑地址 + 内联创建 + 无左树），
// 仅有的差异通过两个口子注入：
//   noun="图标"                —— 文案
//   toolbar={(reload) => 节点}  —— svg 特有的看板动作（导入 / 导出 / 自检 / 归一化），
//                                 这些动作完成后需要刷新列表，所以收 reload 而不是静态节点。
import { createPortal } from 'react-dom';
import { Btn } from '../btn/index.jsx';
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { useStore } from '../../store.jsx';
import { useBatch } from './batch.jsx';
import { SvgGallery } from './gallery.jsx';
import { SvgZipIoBtns } from './zip-io.jsx';
import { ManagePage } from '../asset/manage.jsx';

const enc = encodeURIComponent;
const encPath = (p) => p.split('/').map(enc).join('/');

function SvgBoardActions({ reload, group }) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node: dlgNode } = useDialog();
  const { boot } = useStore();
  const bin = boot?.app?.name || 'nx-ft';
  // 批量动作的作用域 = 当前目录（SvgDrive 把路由里的 path 传进来；根 = 全库）
  const batch = useBatch({ bin, dialog, guard, toast, reload, group });

  return (
    <>
      {/* 导入 / 导出走 btn/zip-io.jsx 的通用外壳 + 本域 strategy（components/svg/zip-io.jsx）——
          选文件 / 下载 / busy / toast / 浮层逃出菜单（详见 zip-io.jsx 注释）全在那边收口。
          group="" 保持与旧「批量导出」同口径（作用于全库；进入分组后按需再收窄）。
          onDone 让导入完成后 ManagePage 跟着 reload 树。 */}
      <SvgZipIoBtns bin={bin} group={group} onDone={reload} />
      <Btn size="sm" variant="secondary" onClick={() => batch.check()}>规范自检</Btn>
      <Btn size="sm" variant="secondary" onClick={() => batch.fix()}>一键归一化</Btn>
      {/* 规范自检 / 一键归一化的对话框同样会被收起的菜单藏住，一起 portal 出去
          （io 的浮层在 zip-io.jsx 里各自逃，不在这里） */}
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
            />
          ),
        },
      ]}
      toolbar={(reload) => <SvgBoardActions reload={reload} group={path} />}
      onNavigate={(dir) => {
        location.hash = dir ? `#/svg/dir/${encPath(dir)}` : '#/svg';
      }}
      onOpen={(group, name) => {
        location.hash = `#/svg/edit/${encPath(group)}/${enc(name)}`;
      }}
    />
  );
}
