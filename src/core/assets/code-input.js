// 代码输入的归一：同一份代码有两条入口，语义必须完全一致。
//   flag —— CLI 的 --code / --code-html / --code-css / --code-js
//   body —— HTTP JSON body（面板走这条）：html / svg / css / js
// 两条入口在这里汇合成同一个 files 对象 `{html|svg, css, js}`，下游只看这个对象。
//
// 为什么值得单独一个文件：这是「CLI 与 Web 面板同源」这个承诺最容易破的地方——
// 某天有人给 CLI 加个槽位、忘了给 body 加，两个入口就开始分叉，而且不会报错。
// 槽位表放在一处，改一次两边一起变。
//
// 注意：槽位**合法性校验**（写错键名报错）在 styles.js 的 saveCode 里，
// 那是唯一的写入口。这里只负责「把两条入口汇成同一个 files 对象」，不重复校验。
export const CODE_KEYS = {
  html: [
    ['html', 'code-html'],
    ['css', 'code-css'],
    ['js', 'code-js'],
  ],
  svg: [
    ['svg', 'code'],
    ['css', 'code-css'],
    ['js', 'code-js'],
  ],
  color: [
    ['data', 'code-data'],
  ],
};

export function collectFiles(ctx, kind) {
  const files = {};
  for (const [bodyKey, flagKey] of CODE_KEYS[kind]) {
    const v = ctx[flagKey] !== undefined ? ctx[flagKey] : ctx[bodyKey];
    if (v !== undefined) files[bodyKey] = v;
  }
  return files;
}

export function codeFlags(kind) {
  if (kind === 'html') {
    return {
      'code-html': { type: 'string', hint: 'html|-' },
      'code-css': { type: 'string', hint: 'css|-' },
      'code-js': { type: 'string', hint: 'js|-' },
    };
  }
  if (kind === 'color') {
    return {
      'code-data': { type: 'string', hint: 'JSON 字符串或 -' },
    };
  }
  return {
    code: { type: 'string', hint: 'svg|-' },
    'code-css': { type: 'string', hint: 'css|-' },
    'code-js': { type: 'string', hint: 'js|-' },
  };
}
