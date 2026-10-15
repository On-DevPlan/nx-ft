// JS 着色扫描器（纯函数：源码字符串 → [类型, 文本] 段序列）。
//
// 与 css.js 同一条硬约束：**不丢字符**，拼回去必须等于源码。
// 已知的取舍：正则字面量不做上下文判定（`/` 一律按运算符处理），
// 所以 `/re/g` 会被描成几段普通记号而不是字符串。要判准得先知道上一个有效
// 记号是不是「值」——那是解析器的事，这里不值得为编辑框的配色付这个代价。
const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'break', 'continue', 'class', 'extends', 'new', 'this', 'super', 'import', 'export',
  'from', 'as', 'default', 'async', 'await', 'try', 'catch', 'finally', 'throw',
  'typeof', 'instanceof', 'in', 'of', 'delete', 'void', 'yield', 'static', 'get', 'set',
]);
const LITERALS = new Set(['null', 'undefined', 'true', 'false', 'NaN', 'Infinity']);
const IDENT = /^[A-Za-z_$][\w$]*/;

export function scanJs(src) {
  const out = [];
  const push = (t, s) => {
    if (s) out.push([t, s]);
  };
  let i = 0;

  while (i < src.length) {
    const rest = src.slice(i);

    if (rest.startsWith('//')) {
      const end = src.indexOf('\n', i);
      const j = end < 0 ? src.length : end;
      push('com', src.slice(i, j));
      i = j;
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = src.indexOf('*/', i + 2);
      const j = end < 0 ? src.length : end + 2;
      push('com', src.slice(i, j));
      i = j;
      continue;
    }

    const c = src[i];

    // 字符串与模板串（模板串不解析 ${} 里的表达式，整段当着色成字符串——
    // 与正则那条同一种取舍：够用即可，不值得为配色引入解析）
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') j += 2;
        else if (src[j] === c) {
          j += 1;
          break;
        } else j += 1;
      }
      push('str', src.slice(i, Math.min(j, src.length)));
      i = Math.min(j, src.length);
      continue;
    }

    const n = /^(0[xX][\da-fA-F]+|\d[\d.eE+-]*)/.exec(rest);
    if (n) {
      push('num', n[0]);
      i += n[0].length;
      continue;
    }

    const id = IDENT.exec(rest);
    if (id) {
      const w = id[0];
      if (KEYWORDS.has(w)) push('key', w);
      else if (LITERALS.has(w)) push('num', w);
      // 函数名：后面紧跟 '(' 的标识符
      else if (/^\s*\(/.test(src.slice(i + w.length))) push('fn', w);
      else push('', w);
      i += w.length;
      continue;
    }

    push('punct', c);
    i += 1;
  }

  return out;
}
