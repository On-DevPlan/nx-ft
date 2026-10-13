// 内联渲染 SVG 源码：看板上每个图标都要直接画在页面上，而不是每个都开一个 iframe。
//
// 为什么必须消毒：图标源码来自本机资源库，而 `svg import` 可以指向任意目录
// （比如一个下载文件夹）。走 dangerouslySetInnerHTML 时，<script>、on* 事件、
// foreignObject 这些载荷会真的执行。这里做的是**定点剥离**而不是完整解析 SVG 树——
// 库里的图标是我们自己的资产，上一套完整解析器只会误伤合法路径，得不偿失。
import { useMemo } from 'react';

const STRIP = [
  [/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, ''], // 成对 <script>
  [/<\s*script[^>]*\/\s*>/gi, ''], // 自闭合 <script/>
  [/<\s*foreignObject[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, ''], // 可嵌 HTML
  [/<\s*iframe[\s\S]*?<\s*\/\s*iframe\s*>/gi, ''],
  [/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ''], // onload= / onclick= …
  [/(?:href|xlink:href)\s*=\s*(?:"|')?\s*(?:javascript:|data:text\/html)[^"'>\s]*/gi, ''],
  [/<\s*!DOCTYPE[^>]*>/gi, ''],
];

export function safeSvg(src) {
  let s = String(src || '').trim();
  if (!s) return '';
  for (const [re, to] of STRIP) s = s.replace(re, to);
  return s;
}

// 一个图标。size 是外框边长，颜色交给 CSS（图标规范要求 currentColor）。
export function Icon({ svg, size = 24, className = '', title }) {
  const html = useMemo(() => safeSvg(svg), [svg]);
  const style = { width: size, height: size };
  if (!html) {
    return <span className={'icon icon-blank' + (className ? ' ' + className : '')} style={style} />;
  }
  return (
    <span
      className={'icon' + (className ? ' ' + className : '')}
      style={style}
      title={title}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// 图标占位（还没写代码的资源）：保持与真图标同样的占位尺寸，网格不塌。
export function IconGhost({ size = 24 }) {
  return <span className="icon icon-ghost" style={{ width: size, height: size }} />;
}
