// 子组件：HTML 资源库的 zip 导入 / 导出——具体实现层在这里。
//
// 与 components/svg/zip-io.jsx 是并列的两份，差异只在**服务端约定**（这里对应
// core/assets/set.js 的一资源一目录三件套；svg 那份对应 core/svg/set.js 的平铺
// 单文件）。通用外壳（选文件 / 下载 / busy / toast）都在 components/btn/zip-io.jsx，
// 本文件只注入两个策略 + 结果面板，所以两边薄得可以各留一份。
//
// 导入：选中的 zip 原样 POST 到 /api/<kind>/import.zip，服务端解包落库
//       （与 CLI `<kind> import --from x.zip` 是同一份核心函数）。
// 导出：GET /api/<kind>/export.zip 取回 blob，文件名从 Content-Disposition 解出；
//       下载动作交还原组件统一触发。
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { apiUpload } from '../../api/client.js';
import { Modal, useDialog, useGuard } from '../ui.jsx';
import { Btn } from '../btn/index.jsx';
import { ZipIoBtn } from '../btn/zip-io.jsx';

const enc = encodeURIComponent;

// 结果面板：字段与 svg 那份同构（core 两个 set.js 的返回结构一致）
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

// Content-Disposition 里的文件名：优先 RFC 5987 的 filename*（中文真名），
// 退回 ASCII 的 filename，再退兜底名。服务端两个字段都发（见 zip-download.js）。
function filenameFromDisposition(header, fallback) {
  if (!header) return fallback;
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // 编码残缺就落到下面的 ASCII 字段
    }
  }
  const plain = header.match(/filename="([^"]+)"/i);
  return plain ? plain[1] : fallback;
}

export function AssetZipIoBtns({
  kind = 'html',
  bin = 'nx-ft',
  group = '',
  onDone,
  size = 'sm',
  variant = 'secondary',
  side = 'both',
  importLabel = '导入 zip',
  exportLabel = '导出 zip',
}) {
  const guard = useGuard();
  const { dialog, node: dlgNode } = useDialog();
  const [modal, setModal] = useState(null);

  // side：有的场景只需要一侧（如空库提示里只放导入）。原组件按
  // 「strategy 缺哪个成员就不渲染哪个按钮」工作，这里顺势按需装配。
  const strategy = {};
  if (side !== 'export') {
    // 导入：先问目标分组，结果弹窗逐条列出导入了哪些槽位（三件套可能只有一两件）
    strategy.importZip = (file) =>
      guard(async () => {
        const target = await dialog({
          title: '导入 zip 到哪个分组',
          input: true,
          value: group || '',
          placeholder: 'ui/buttons',
          message: '最多 8 段路径；不存在会自动创建。约定：每个资源一个目录，内含 index.html / style.css / script.js。同名资源默认跳过。',
          okText: '导入',
        });
        if (!target) return '';
        const r = await apiUpload(`/api/${kind}/import.zip`, file, {
          query: { group: target, style: 'default', 'label-from': 'title' },
        });
        onDone?.();
        setModal({
          title: '导入完成',
          node: (
            <Result
              title={`已导入 ${r.imported.length} 个到 ${r.group}${r.groupCreated ? '（分组为本次新建）' : ''}${
                r.skipped.length ? ` · 跳过 ${r.skipped.length} 个` : ''
              }`}
              lines={[
                ...r.imported.map((i) => `+ ${i.name}  (${i.label})  [${(i.slots || []).join(',')}]  ${i.bytes} B`),
                ...r.skipped.map((s) => `= ${s.name} —— ${s.reason}`),
              ]}
              empty="zip 里没有可导入的资源。"
            />
          ),
        });
        return '';
      });
  }
  if (side !== 'import') {
    // 导出：服务端打包（core/assets/set.js），这里只取回内容，触发下载是原组件的事。
    // 失败时 res.text() 是人类可读的原因（该端点失败回纯文本，见 zip-download.js）。
    strategy.exportZip = () =>
      guard(async () => {
        const res = await fetch(`/api/${kind}/export.zip` + (group ? '?group=' + enc(group) : ''));
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
        return {
          filename: filenameFromDisposition(res.headers.get('content-disposition'), `${kind}-export.zip`),
          blob: await res.blob(),
        };
      });
  }

  return (
    <>
      <ZipIoBtn
        strategy={strategy}
        importLabel={importLabel}
        exportLabel={exportLabel}
        size={size}
        variant={variant}
        exportTestId="export-zip"
      />
      {/* 浮层 portal 到 body：本组件会被接进「更多」菜单（`<details>` 收起时
          内容 display:none，内联的对话框/结果窗会跟着被藏住）。按钮留在原地，
          浮层逃出去——接入位置的自由度与浮层可见性互不影响。 */}
      {createPortal(
        <>
          {dlgNode}
          {modal ? (
            <Modal title={modal.title} onClose={() => setModal(null)}>
              {modal.node}
              <div className="batch-foot">
                <span className="muted">
                  等价命令：<code className="mono">{bin} {kind} import 分组 --from 资源包.zip</code>
                </span>
                <Btn onClick={() => setModal(null)}>知道了</Btn>
              </div>
            </Modal>
          ) : null}
        </>,
        document.body
      )}
    </>
  );
}
