// 命令式 zip 局部导入导出：供目录树右键某个目录时，把外部资源导入到该目录、
// 或把该目录（含子目录）导出。
//
// 与 components/svg|asset/zip-io.jsx 的按钮组件区别：那两个渲染按钮、导入时再问
// 目标分组；这里命令式——目标分组已由右键的目录锁定，直接拉起文件选择 / 下载，
// 不再追问。URL 模式 html/svg 一致（kind 驱动），一个 hook 两域共用。
//
// 后端：
//   导入 POST /api/<kind>/import.zip?group=...（扁平落目标 group，资源名取文件名）
//   导出 GET  /api/<kind>/export.zip?pick=[{"type":"dir","path":...}]（pick 递归子目录；
//          group 模式只导出该组本身，故右键"导出整个文件夹"走 pick）
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiUpload } from '../../api/client.js';
import { Modal, useGuard, useToast } from '../ui.jsx';
import { Btn } from '../btn/index.jsx';

const enc = encodeURIComponent;

// blob → 下载（与 components/btn/zip-io.jsx 的 downloadBlob 同口径）
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Content-Disposition 文件名（与两个 zip-io 组件同款：优先 RFC 5987 中文真名）
function filenameFromDisposition(header, fallback) {
  if (!header) return fallback;
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // 编码残缺落到下面 ASCII 字段
    }
  }
  const plain = header.match(/filename="([^"]+)"/i);
  return plain ? plain[1] : fallback;
}

// 结果面板：与批量运维（batch.jsx）同一款样式
function Result({ title, lines, empty }) {
  return (
    <div className="batch-result">
      <div className="batch-result-head">{title}</div>
      {lines.length ? (
        <pre className="snippet-box batch-pre">{lines.join('\n')}</pre>
      ) : (
        <div className="empty">{empty}</div>
      )}
    </div>
  );
}

export function useZipIo(kind, { onChanged } = {}) {
  const guard = useGuard();
  const toast = useToast();
  const inputRef = useRef(null);
  const pendingGroup = useRef('');
  const [modal, setModal] = useState(null);

  // 选中文件后：上传到锁定的目标 group，弹结果窗
  const onPick = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // 清 value，否则第二次选同一文件不触发 change
    if (!file) return;
    const group = pendingGroup.current;
    guard(async () => {
      const r = await apiUpload(`/api/${kind}/import.zip`, file, {
        query: { group, style: 'default', 'label-from': 'title' },
      });
      onChanged?.();
      setModal({
        title: '导入完成',
        node: (
          <Result
            title={`已导入 ${r.imported.length} 个到 ${r.group}${r.groupCreated ? '（分组为本次新建）' : ''}${
              r.skipped.length ? ` · 跳过 ${r.skipped.length} 个` : ''
            }`}
            lines={[
              // html 导入项带 slots（三件套收了哪几件），svg 无 slots（平铺单文件）
              ...r.imported.map((i) =>
                `+ ${i.name}  (${i.label})` + (i.slots ? `  [${i.slots.join(',')}]` : '') + `  ${i.bytes} B`
              ),
              ...r.skipped.map((s) => `= ${s.name} —— ${s.reason}`),
            ]}
            empty="zip 里没有可导入的资源。"
          />
        ),
      });
    });
  };

  // 局部导入：记住目标目录，拉起文件选择
  const importToGroup = (group) => {
    pendingGroup.current = group;
    inputRef.current?.click();
  };

  // 局部导出：pick 单个目录（递归子目录），取回 blob 下载
  const exportGroup = (group) =>
    guard(async () => {
      const pick = [{ type: 'dir', path: group }];
      const res = await fetch(`/api/${kind}/export.zip?pick=` + enc(JSON.stringify(pick)));
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const filename = filenameFromDisposition(res.headers.get('content-disposition'), `${kind}-export.zip`);
      downloadBlob(filename, await res.blob());
      toast(`已开始下载 ${filename}`);
      return filename;
    });

  const node = (
    <>
      <input ref={inputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={onPick} />
      {/* portal 到 body：本组件会被接进右键菜单（菜单项关闭后内容被卸载），
          浮层逃出去，结果窗不随菜单关闭而消失。 */}
      {createPortal(
        modal ? (
          <Modal title={modal.title} onClose={() => setModal(null)}>
            {modal.node}
            <div className="batch-foot">
              <Btn onClick={() => setModal(null)}>知道了</Btn>
            </div>
          </Modal>
        ) : null,
        document.body
      )}
    </>
  );

  return { importToGroup, exportGroup, node };
}
