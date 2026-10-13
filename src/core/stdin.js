// stdin 读取：CLI 多行文本输入（heredoc / 管道）的唯一入口。
//
// 为什么必须有这一层：多行内容当 argv 传时，跨 exec 边界会被 shell 切成
// 「只剩第一行」，后面的 flag 静默丢失（Windows/Git Bash 实测）。约定
// 参数值写 `-` 表示「从 stdin 读」，内容根本不经过 argv。
import { badInput } from './errors/index.js';

const DEADLINE_MS = 10_000; // heredoc/管道毫秒级到达；上限只为「stdin 挂着不关」兜底

export function stdinText({ timeoutMs = DEADLINE_MS } = {}) {
  if (process.stdin.isTTY) {
    return Promise.reject(
      badInput('参数值 - 表示从 stdin 读，但当前是交互终端。用法: 命令 ... - <<\'EOF\'\n多行内容\nEOF')
    );
  }
  return new Promise((resolve, reject) => {
    let buf = '';
    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      process.stdin.removeListener('error', onErr);
      fn(arg);
    };
    const onData = (chunk) => (buf += chunk);
    const onEnd = () =>
      finish(resolve, buf.replace(/\r\n/g, '\n').replace(/[\n\r]+$/, ''));
    const onErr = (e) => finish(reject, e);
    const timer = setTimeout(() => finish(reject, badInput(`stdin 读取超时（${timeoutMs}ms）`)), timeoutMs);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onErr);
  });
}
