// 原组件：导入 / 导出按钮的通用外壳（zip 进、zip 出）。
//
// 职责边界是刻意的：这个文件只做「与业务无关的通用流程」——
//   导入：拉起文件选择（.zip）→ 把 File 交给策略 → busy 态 → 结果 toast；
//   导出：调策略拿 { filename, blob } → 统一触发一次浏览器下载。
// zip 怎么解析、打到哪个接口、文件名叫什么、作用范围是哪个分组——全部由
// strategy 注入，具体实现层在业务子组件（见 components/svg/zip-io.jsx）。
// 将来出现第三种资源库要接导入导出，写一个新的 strategy 子组件即可，
// 这个文件一行不用改。
//
// 内部按钮走 Btn 而非自拼「`.btn small ghost`」：把按钮族规范在这里也兜住。
// 调用方只传 size/variant，不再传原始 className 字符串。
//
// strategy 契约（两个成员都可选，缺哪侧就不渲染哪个按钮）：
//   importZip?: (file: File) => Promise<string | void>
//     接住选中的 zip，自行上传/解析。resolve 出非空字符串就 toast（适合一句话
//     结果）；resolve 空值则保持安静（适合已经自己弹了结果窗）。
//   exportZip?: () => Promise<{ filename: string, blob: Blob }>
//     产出 zip 内容与文件名。下载动作（objectURL + <a download>）在这里统一做，
//     业务不碰 DOM——服务端流式下载也先 fetch 成 blob，失败才有得报错。
import { useRef, useState } from 'react';
import { Btn } from './index.jsx';
import { useGuard, useToast } from '../ui.jsx';

// blob → 下载的唯一出口。用 <a download> 而不是 location.href：
// 不打扰当前页面的路由与状态；objectURL 用完即回收。
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

export function ZipIoBtn({
  strategy,
  importLabel = '导入',
  exportLabel = '导出',
  accept = '.zip',
  size = 'sm',
  variant = 'secondary',
  exportTestId,
}) {
  const toast = useToast();
  const guard = useGuard();
  const inputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // guard 会把策略抛出的错误转成 toast，所以两个流程的收尾都只需要关 busy
  const onPick = (e) => {
    const file = e.target.files && e.target.files[0];
    // 先清空 value：不清的话，第二次选同一个文件不会触发 change
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    guard(async () => {
      const summary = await strategy.importZip(file);
      if (summary) toast(summary);
    }).then(() => setImporting(false));
  };

  const onExport = () => {
    setExporting(true);
    guard(async () => {
      const { filename, blob } = await strategy.exportZip();
      downloadBlob(filename, blob);
      toast(`已开始下载 ${filename}`);
    }).then(() => setExporting(false));
  };

  return (
    <>
      {strategy.importZip ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={onPick}
          />
          <Btn size={size} variant={variant} busy={importing} onClick={() => inputRef.current?.click()}>
            {importing ? '导入中…' : importLabel}
          </Btn>
        </>
      ) : null}
      {strategy.exportZip ? (
        <Btn size={size} variant={variant} busy={exporting} onClick={onExport} testId={exportTestId}>
          {exporting ? '导出中…' : exportLabel}
        </Btn>
      ) : null}
    </>
  );
}
