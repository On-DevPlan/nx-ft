// 语法着色的入口：把源码按语言切成 [类型, 文本] 段。
//
// 为什么自己写而不引 Prism / CodeMirror：这个项目的 dependencies 只有 react 与
// react-dom，且要发布到 npm——为一处配色拉进一整个解析库不划算，而编辑器现有的
// 非受控 textarea（撤销栈、Tab 缩进、Ctrl+S、行号、readCode 读 .code-area.value
// 的契约）一处都不用动，只在它下面叠一层着色好的 <pre> 即可。
//
// 硬约束：**任何输入都不能丢字符**，把返回的段按序拼回去必须逐字等于入参。
// 叠加层是照着同一份文本画的，丢一个字符就整体串行（见 components/asset/CodeEditor.jsx）。
import { scanCss } from './css.js';
import { scanHtml } from './html.js';
import { scanJs } from './js.js';

// svg 与 html 是同一套标记语法，共用扫描器
const SCANNERS = { html: scanHtml, svg: scanHtml, css: scanCss, js: scanJs };

/**
 * 切词。返回 [{ type, text }]，type 为配色类别（见 styles/asset-workbench.css 的 .tok-*），
 * 无配色的段落 type 为 ''。
 */
export function tokenize(code, lang) {
  const src = String(code ?? '');
  if (!src) return [];
  const scan = SCANNERS[lang];
  if (!scan) return [{ type: '', text: src }];
  return scan(src, { css: scanCss, js: scanJs }).map(([type, text]) => ({ type, text }));
}
