// toast 语义色映射（纯函数，可单测）。
// 三档：ok（成功绿）/ bad（失败红）/ warn（警告黄）。
const TONES = {
  ok: 'ok',
  success: 'ok',
  bad: 'bad',
  error: 'bad',
  err: 'bad',
  fail: 'bad',
  warn: 'warn',
  warning: 'warn',
};

export function normalizeTone(tone) {
  return TONES[tone] || 'ok';
}
