// 子组件：SVG 图标库的 zip 导入 / 导出——具体实现层在这里。
//
// 通用外壳（选文件 / 下载 / busy / toast）在原组件 ZipIoBtn；本组件注入的是
// svg 业务的两个策略：
//   导入：选中的 zip 原样 POST 到 /api/svg/import.zip，服务端解包落库
//         （与 CLI `svg import --from x.zip` 是同一份核心 set.importZipBuffer）。
//   导出：GET /api/svg/export.zip 取回 blob，文件名从 Content-Disposition 解出；
//         下载动作交还原组件统一触发。
// 导入前问一次目标分组（预填当前目录），完成后弹结果面板。
// 注意本组件是**独立交付的**：不反向依赖看板页（batch.jsx / drive.jsx），
// 接进哪个页面由接入方决定；结果面板在这里自带一份同款实现。
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { apiUpload } from '../../api/client.js';
import { Modal, useDialog, useGuard } from '../ui.jsx';
import { Btn } from '../btn/index.jsx';
import { ZipIoBtn } from '../btn/zip-io.jsx';

const enc = encodeURIComponent;

// 结果面板：与批量运维（batch.jsx）同一款样式，独立成份以免把子组件
// 绑死在看板页的内部实现上。
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

export function SvgZipIoBtns({ bin = 'nx-ft', group = '', onDone, size = 'sm', variant = 'secondary', side = 'both' }) {
  const guard = useGuard();
  const { dialog, node: dlgNode } = useDialog();
  const [modal, setModal] = useState(null);

  // side：有的场景只需要一侧（如空库提示里只放导入）。原组件按
  // 「strategy 缺哪个成员就不渲染哪个按钮」工作，这里顺势按需装配。
  const strategy = {};
  if (side !== 'export') {
    // 导入：浏览器里的 zip 不再让用户填服务器本机目录。分组先问后传，
    // 结果弹窗与批量运维同一个样式，导入/跳过逐条可见。
    strategy.importZip = (file) =>
      guard(async () => {
        const target = await dialog({
          title: '导入 zip 到哪个分组',
          input: true,
          value: group || '',
          placeholder: 'ui/icons',
          // 段数上限的真相在 core/assets/constants.js 的 GROUP_DEPTH_MAX（当前 8）
          message: '最多 8 段路径；不存在会自动创建。同名资源默认跳过。',
          okText: '导入',
        });
        if (!target) return '';
        const r = await apiUpload('/api/svg/import.zip', file, {
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
                ...r.imported.map((i) => `+ ${i.name}  (${i.label})  ${i.bytes} B`),
                ...r.skipped.map((s) => `= ${s.name} —— ${s.reason}`),
              ]}
              empty="zip 里没有可导入的图标。"
            />
          ),
        });
        return '';
      });
  }
  if (side !== 'import') {
    // 导出：服务端 store 打包（零依赖，见 core/zip.js）；这里只取回内容，
    // 触发下载是原组件的事。失败时 res.text() 是人类可读的原因（该端点失败
    // 回纯文本，见 zip-download.js），直接当错误消息抛给 toast。
    strategy.exportZip = () =>
      guard(async () => {
        const res = await fetch('/api/svg/export.zip' + (group ? '?group=' + enc(group) : ''));
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
        return {
          filename: filenameFromDisposition(res.headers.get('content-disposition'), 'svg-export.zip'),
          blob: await res.blob(),
        };
      });
  }

  return (
    <>
      <ZipIoBtn strategy={strategy} importLabel="导入 zip" exportLabel="导出 zip" size={size} variant={variant} exportTestId="export-zip" />
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
                  等价命令：<code className="mono">{bin} svg import --from 图标.zip</code>
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
