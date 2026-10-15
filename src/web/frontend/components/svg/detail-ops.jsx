// 资源页的操作集合：保存 / 风格 / 标签 / 历史 / 删除。
// 与 components/asset/useAssetOps.js 同构（都是「会弹窗、会调接口」的那一层），
// 差别只在：这里多了「按规范修复」与「编辑历史回退」——图标集特有的两个动作。
import { api } from '../../api/client.js';
import { Btn } from '../btn/index.jsx';
import { stamp } from './parts.jsx';

export function makeDetailOps({
  bin, group, name, sel, asset, readCode, isDirty, reload, dialog, guard, toast, nav, setModal,
}) {
  const ref = { group, name };
  const cur = () => sel.style || asset?.activeStyle || asset?.styles?.[0]?.name || '';

  const save = () =>
    guard(async () => {
      const style = cur();
      if (!style) {
        toast.warn('先新建一个风格');
        return;
      }
      if (!isDirty()) {
        toast.warn('没有改动');
        return;
      }
      const r = await api('/api/svg/asset-code', {
        method: 'POST',
        body: { ...ref, style, ...readCode() },
      });
      await reload();
      if (r.status === 'skipped') toast.warn('内容无变化');
      else toast.ok(`已保存（${r.changed.join(', ')}；历史 ${r.historyCount} 条）`);
    });

  const newStyle = () =>
    guard(async () => {
      const style = await dialog({
        title: '新增风格',
        message: '风格数量不限，用于并存多套实现做对比；新风格会复制当前风格的代码。',
        input: true,
        placeholder: '如 outline / filled / rounded',
        okText: '创建并复制当前代码',
      });
      if (!style) return;
      const body = { ...ref, style };
      if (cur()) body['copy-from'] = cur();
      await api('/api/svg/styles', { method: 'POST', body });
      await reload();
      toast('已新增风格: ' + style);
    });

  const removeStyle = () =>
    guard(async () => {
      const style = cur();
      const ok = await dialog({
        title: `删除风格 ${style}？`,
        message: '该风格的代码与全部编辑历史会一并删除，不可恢复。',
        okText: '删除',
        danger: true,
      });
      if (!ok) return;
      await api('/api/svg/style-remove', { method: 'POST', body: { ...ref, style } });
      await reload();
      toast('已删除风格: ' + style);
    });

  const setActive = (style) =>
    guard(async () => {
      await api('/api/svg/style-active', { method: 'POST', body: { ...ref, style: style || cur() } });
      await reload();
      toast('当前风格已切到: ' + (style || cur()));
    });

  const rename = () =>
    guard(async () => {
      const label = await dialog({
        title: '修改展示名',
        input: true,
        value: asset?.label || '',
        message: `只改展示名，目录名 ${name} 不变。`,
      });
      if (!label) return;
      await api('/api/svg/asset-rename', { method: 'POST', body: { ...ref, label } });
      await reload();
      toast('已重命名');
    });

  // 主描述（资源级）：与风格描述分工——主描述说「这是什么场景」。
  // 面板上不再弹对话框，直接收文本（DescPanel 的编辑模式里批量保存）。
  const saveAssetDesc = (text) =>
    guard(async () => {
      await api('/api/svg/asset-desc', { method: 'POST', body: { ...ref, text } });
      await reload();
    });

  // 风格描述：多风格并存时用来记「这套实现的特征」。传空串即清除。
  // 直接收文本（面板 inline 编辑）；仍是同一个端点，与 CLI 的 `svg style desc` 同源。
  const saveStyleDesc = (style, text) =>
    guard(async () => {
      await api('/api/svg/style-desc', { method: 'POST', body: { ...ref, style, text } });
      await reload();
    });

  const setDesc = () =>
    guard(async () => {
      const style = cur();
      if (!style) {
        toast.warn('先选一个风格');
        return;
      }
      const current = asset?.styles?.find((s) => s.name === style)?.desc || '';
      const text = await dialog({
        title: `描述风格 ${style}`,
        input: true,
        value: current,
        message: '一句话说清这套实现的特征（如「圆角更小，适合密集列表」）。留空即清除。',
        placeholder: '一句话特征',
        okText: '保存描述',
      });
      if (text === null) return;
      await saveStyleDesc(style, text);
      toast(text ? '已更新描述' : '已清除描述');
    });

  const addTags = () =>
    guard(async () => {
      const raw = await dialog({
        title: '添加标签',
        message: '逗号分隔可多个；小写存储，支持汉字。标签用于看板筛选与搜索。',
        input: true,
        placeholder: 'button, outline',
        okText: '添加',
      });
      if (!raw) return;
      const tags = String(raw).split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      if (!tags.length) return;
      const r = await api('/api/svg/tags-add', { method: 'POST', body: { ...ref, tags } });
      await reload();
      if (r.status === 'skipped') toast.warn('标签已存在');
      else toast.ok('已加标签: ' + (r.added || []).join(', '));
    });

  const removeTag = (tag) =>
    guard(async () => {
      await api('/api/svg/tags-remove', { method: 'POST', body: { ...ref, tags: [tag] } });
      await reload();
      toast('已移除标签: ' + tag);
    });

  const removeAsset = () =>
    guard(async () => {
      const ok = await dialog({
        title: `删除图标 ${name}？`,
        message: `含 ${asset?.styles?.length || 0} 个风格，全部代码与历史将删除，不可恢复。`,
        okText: '删除',
        danger: true,
      });
      if (!ok) return;
      await api('/api/svg/asset-remove', { method: 'POST', body: { ...ref, force: true } });
      toast('已删除: ' + group + '/' + name);
      nav.group(group);
    });

  // 按规范修复当前风格：只动这一个风格的 svg，改动照样进历史。
  const fixStyle = () =>
    guard(async () => {
      const style = cur();
      const r = await api('/api/svg/spec-fix', {
        method: 'POST',
        body: { group, style, profile: 'line' },
      });
      await reload();
      if (!r.changed.length) {
        toast.warn('这个风格已经合规，无需修复');
        return;
      }
      toast('已按规范修复：' + (r.changed[0].changed || []).join('，'));
    });

  // 编辑历史：最近 5 条快照，逐条可回退（当前状态会再入历史，因此回退本身也可回退）。
  const history = () =>
    guard(async () => {
      const style = cur();
      const r = await api(
        `/api/svg/history?group=${encodeURIComponent(group)}&name=${encodeURIComponent(name)}&style=${encodeURIComponent(style)}`
      );
      setModal(
        <div className="hist">
          <div className="hist-head muted">
            {group}/{name}@{style} · 保留最近 {r.keep} 条（每次保存自动生成）
          </div>
          {r.history.length ? (
            r.history.map((h) => (
              <div key={h.id} className="hist-row">
                <span className="mono">{h.id}</span>
                <span className="muted mono">{stamp(h.at)}</span>
                <Btn
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await restore(style, h.id);
                  }}
                >
                  回退到这条
                </Btn>
              </div>
            ))
          ) : (
            <div className="empty">还没有历史（保存一次就会出现）。</div>
          )}
          <div className="hist-foot muted mono">{bin} svg history list {group} {name} {style}</div>
        </div>
      );
    });

  const restore = (style, entry) =>
    guard(async () => {
      await api('/api/svg/history-restore', { method: 'POST', body: { ...ref, style, entry } });
      setModal(null);
      await reload();
      toast('已回退到快照 ' + entry);
    });

  return { save, newStyle, removeStyle, setActive, rename, setDesc, addTags, removeTag, removeAsset, fixStyle, history, cur, saveAssetDesc, saveStyleDesc };
}
