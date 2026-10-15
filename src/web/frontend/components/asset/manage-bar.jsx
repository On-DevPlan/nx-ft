// 管理页工具区（V3 主从收纳）：面包屑 + 新建菜单 + 搜索 + 「更多」菜单。
// 由 ManagePage 组装、ShellBar 传送进 Layout 的工具区；本组件只管排布与
// 输入行开合，创建本身交给 onCreateAsset / onCreateDir（目录解析在 ManagePage——
// 根目录下的资源要落进保留文件夹「未分类」）。
//
// 「+ 新建」是菜单不是单按钮：资源与子目录的落点都是**当前（= 侧边栏高亮）目录**——
// 与侧边栏头部那个「+」同一套语义，两处入口不该有两套规矩。
//
// 菜单收纳的分组：视图切换 / 领域批量动作（svg 经 extra 传入）/ 目录动作。
// 点任意菜单项后菜单自动收起（都是「做完即走」型动作）。
//
// 与按钮族的关系：所有按钮、下拉、撑杆都走 components/btn 的统一组件；
// 本文件只负责菜单的「内容」与受控的「正在输入名字」分支。
import { useState } from 'react';
import { BtnBar, BtnBarSpacer, BtnMenu, BtnMenuItem, BtnMenuLabel, BtnMenuSep } from '../btn/index.jsx';
import { Crumbs, InlineCreateRow } from './parts.jsx';

export function ManageBar({
  crumbs,
  inDir,
  onRenameDir,
  onRemoveDir,
  onCreateAsset,
  onCreateDir,
  search,
  onSearch,
  searchPlaceholder = '搜索名称 / 分组 / 标签 / 风格',
  viewId,
  onView,
  defaultViewLabel,
  views,
  onBatch,
  extra,
}) {
  const [creating, setCreating] = useState(null); // null | 'asset' | 'dir'
  return (
    <BtnBar>
      <Crumbs items={crumbs} />
      <BtnBarSpacer />
      {creating ? (
        <InlineCreateRow
          placeholder={
            creating === 'dir' ? '子目录名称，可用 / 建多层，如 ui/buttons' : '资源名称，如 login-btn'
          }
          confirmText={creating === 'dir' ? '创建目录' : '创建'}
          onConfirm={async (name) => {
            await (creating === 'dir' ? onCreateDir : onCreateAsset)(name);
            setCreating(null);
          }}
          onCancel={() => setCreating(null)}
          testId={creating === 'dir' ? 'inline-create-dir' : 'inline-create-asset'}
        />
      ) : null}
      <input
        className="am-search"
        spellCheck="false"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        data-testid="manage-search"
      />
      {/* 工具区从左到右：次级下拉（更多）→ 主按钮（+ 新建）。
          原实现的「+ 新建」是工具区第一个按钮，现在统一压到行右（主按钮最后一位）。 */}
      <BtnMenu label="更多" testId="more-menu" panelTestId="more-menu-panel">
        {views.length ? (
          <>
            <BtnMenuLabel>视图</BtnMenuLabel>
            <BtnMenuItem current={viewId === 'default'} onClick={() => onView('default')} testId="view-default">
              {defaultViewLabel}
            </BtnMenuItem>
            {views.map((v) => (
              <BtnMenuItem
                key={v.id}
                current={viewId === v.id}
                onClick={() => onView(v.id)}
                testId={`view-${v.id}`}
              >
                {v.label}
              </BtnMenuItem>
            ))}
            <BtnMenuSep />
          </>
        ) : null}
        {extra ? (
          <>
            <BtnMenuLabel>批量</BtnMenuLabel>
            {extra}
            <BtnMenuSep />
          </>
        ) : null}
        <BtnMenuLabel>目录</BtnMenuLabel>
        <BtnMenuItem onClick={onBatch} testId="enter-batch">
          批量操作
        </BtnMenuItem>
        {inDir ? (
          <>
            <BtnMenuItem onClick={onRenameDir} testId="rename-current-group">
              改名 / 移动
            </BtnMenuItem>
            <BtnMenuItem danger onClick={onRemoveDir} testId="remove-current-group">
              删除当前文件夹
            </BtnMenuItem>
          </>
        ) : null}
      </BtnMenu>
      <BtnMenu
        label="+ 新建"
        variant="primary"
        align="left"
        testId="new-menu"
        panelTestId="new-menu-panel"
      >
        <BtnMenuItem onClick={() => setCreating('asset')} testId="new-asset">
          新建资源
        </BtnMenuItem>
        <BtnMenuItem onClick={() => setCreating('dir')} testId="new-dir">
          新建子目录
        </BtnMenuItem>
      </BtnMenu>
    </BtnBar>
  );
}
