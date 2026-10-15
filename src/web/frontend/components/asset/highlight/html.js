// HTML / SVG 着色扫描器（纯函数：源码字符串 → [类型, 文本] 段序列）。
//
// HTML 与 SVG 是同一套标记语法，共用这一个扫描器（调用方传 lang='svg' 也只是走这里）。
// 与 css.js / js.js 同一条硬约束：**不丢字符**，拼回去必须等于源码。
//
// 内联的 <style> / <script> 会外包给对应扫描器处理——工作台里用户常常把整套样式
// 写在同一段 HTML 里，不认这段的话，最长的一块代码反而没有颜色。
const RAW_TEXT = { style: 'css', script: 'js' };
const VOID = /^(br|hr|img|input|meta|link|source|track|area|base|col|embed|param|wbr)$/;

function scanTagInto(tag, push) {
  // 声明：<!doctype html> / <![CDATA[…]]> / <?xml …?>——整段当一个注释色，不细拆
  if (tag[1] === '!' || tag[1] === '?') {
    push('com', tag);
    return;
  }
  let i = 1;
  push('punct', '<');
  if (tag[i] === '/') {
    push('punct', '/');
    i += 1;
  }
  const nm = /^[^\s/>]+/.exec(tag.slice(i));
  if (nm) {
    push('tag', nm[0]);
    i += nm[0].length;
  }
  const hasGt = tag.endsWith('>');
  const body = tag.slice(i, hasGt ? -1 : undefined);
  let r = 0;
  let afterEq = false; // 刚读完 '='：接着的非引号式子串是属性值，不是属性名
  while (r < body.length) {
    const s = body.slice(r);
    const ws = /^\s+/.exec(s);
    if (ws) {
      push('', ws[0]);
      r += ws[0].length;
      continue;
    }
    if (s[0] === '=') {
      push('punct', '=');
      r += 1;
      afterEq = true;
      continue;
    }
    if (s[0] === '/' || s[0] === '>') {
      push('punct', s[0]);
      r += 1;
      continue;
    }
    const q = /^("[^"]*"|'[^']*')/.exec(s);
    if (q) {
      push('str', q[0]);
      r += q[0].length;
      afterEq = false;
      continue;
    }
    // 属性名（SVG 的 viewBox、框架的 :href / @click / data-x 都吃得住）
    const a = /^[^\s=/>]+/.exec(s);
    if (a) {
      push(afterEq ? 'num' : 'attr', a[0]);
      r += a[0].length;
      afterEq = false;
      continue;
    }
    push('punct', s[0]);
    r += 1;
  }
  if (hasGt) push('punct', '>');
}

export function scanHtml(src, sub) {
  const out = [];
  const push = (t, s) => {
    if (s) out.push([t, s]);
  };
  let i = 0;

  while (i < src.length) {
    // 注释
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      const j = end < 0 ? src.length : end + 3;
      push('com', src.slice(i, j));
      i = j;
      continue;
    }

    if (src[i] === '<') {
      const end = src.indexOf('>', i);
      const j = end < 0 ? src.length : end + 1;
      const tag = src.slice(i, j);
      scanTagInto(tag, push);
      i = j;

      // 内联 style / script：内容交给对应扫描器
      const m = /^<\s*([A-Za-z][\w:-]*)/.exec(tag);
      const name = m ? m[1].toLowerCase() : '';
      const lang = RAW_TEXT[name];
      const selfClosed = tag.endsWith('/>') || VOID.test(name);
      if (lang && !selfClosed) {
        const close = new RegExp('</\\s*' + name + '\\s*>', 'i');
        const cm = close.exec(src.slice(i));
        const contentEnd = cm ? i + cm.index : src.length;
        for (const tk of sub[lang](src.slice(i, contentEnd))) out.push(tk);
        i = contentEnd; // 闭合标签下一轮按普通标签处理
      }
      continue;
    }

    // 文本节点：到下一个 '<' 为止
    const nxt = src.indexOf('<', i);
    const j = nxt < 0 ? src.length : nxt;
    push('', src.slice(i, j));
    i = j;
  }

  return out;
}
