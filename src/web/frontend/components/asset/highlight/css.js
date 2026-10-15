// CSS 着色扫描器（纯函数：源码字符串 → [类型, 文本] 段序列）。
//
// 只做「够用的词法」：注释 / 字符串 / at-rule / 选择器 / 属性名 / 属性值。
// 不建 AST，也不追求完备——编辑框里要的是结构一眼可辨，不是编译器级正确。
// 判据只有一条：**任何输入都不能丢字符**，拼回去必须等于源码，否则叠加层会与
// textarea 错位（叠加层是照着同一份文本画的，丢一个字符就整体串行）。
const IDENT = /^[-\w]+/;

export function scanCss(src) {
  const out = [];
  const push = (t, s) => {
    if (s) out.push([t, s]);
  };
  let i = 0;
  let depth = 0; // 花括号层数：0 = 选择器区，>0 = 声明区
  let inValue = false; // 声明区内是否已越过 ':'（越过 = 后面是属性值）

  while (i < src.length) {
    const rest = src.slice(i);

    if (rest.startsWith('/*')) {
      const end = src.indexOf('*/', i + 2);
      const j = end < 0 ? src.length : end + 2;
      push('com', src.slice(i, j));
      i = j;
      continue;
    }

    const c = src[i];

    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      const j = end < 0 ? src.length : end + 1;
      push('str', src.slice(i, j));
      i = j;
      continue;
    }

    if (c === '{') {
      push('punct', c);
      depth += 1;
      inValue = false;
      i += 1;
      continue;
    }
    if (c === '}') {
      push('punct', c);
      depth = Math.max(0, depth - 1);
      inValue = false;
      i += 1;
      continue;
    }
    if (c === ';') {
      push('punct', c);
      inValue = false;
      i += 1;
      continue;
    }
    if (c === ':') {
      // 声明区里的 ':' 分隔属性与值；选择器里的 ':hover' 只是选择器的一部分
      push('punct', c);
      if (depth > 0) inValue = true;
      i += 1;
      continue;
    }

    // at-rule：@media / @keyframes / @import …
    if (c === '@') {
      const m = /^@[-\w]+/.exec(rest);
      push('fn', m ? m[0] : c);
      i += (m ? m[0].length : 1);
      continue;
    }

    // 十六进制色值：#fff / #6c63ff
    if (c === '#') {
      const m = /^#[0-9a-fA-F]{3,8}\b/.exec(rest);
      if (m) {
        push('num', m[0]);
        i += m[0].length;
        continue;
      }
      push('punct', c);
      i += 1;
      continue;
    }

    // 数字 + 单位：52px / 0.3s / 100% / -26px / .5em
    // 正则自身要求 -?.? 之后必须是数字，所以匹配上就一定是数字（-webkit-… 不会误命中）
    const n = /^-?\.?\d[\d.]*(%|[a-zA-Z]+)?/.exec(rest);
    if (n) {
      push('num', n[0]);
      i += n[0].length;
      continue;
    }

    const id = IDENT.exec(rest);
    if (id) {
      // 选择器区 → 选择器；声明区内、冒号之前 → 属性名；冒号之后 → 属性值
      let type = 'sel';
      if (depth > 0) type = inValue ? 'val' : 'prop';
      push(type, id[0]);
      i += id[0].length;
      continue;
    }

    push('punct', c);
    i += 1;
  }

  return out;
}
