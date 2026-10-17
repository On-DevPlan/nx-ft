// 侧边栏图标：内联 SVG，描边跟随 currentColor（零 emoji）。
// 线宽 1.6~1.8、圆头圆角，观感对齐 SF Symbols；视箱统一 20，显示尺寸由 CSS 控制。
export function Chevron({ flip }) {
  return (
    <svg className={flip ? 'flip' : undefined} width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4.4 2.6 8 6l-3.6 3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 文件夹：闭合 / 开口两态都画在一张 svg 里，显隐交给 .gnode.open 的 CSS。
// 双色靠类名（.gfol-pa 背板 / .gfol-pf 前面板），填充色由 sidebar.css 的变量给，
// 选中反白也只在 CSS 层做——svg 保持无状态。
export function FolderGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
      <g className="gfol gfol-closed">
        <path
          className="gfol-pa"
          d="M2.6 5.9c0-1 .8-1.8 1.8-1.8h2.9c.48 0 .94.2 1.27.54l.86.9c.33.34.79.53 1.26.53h5.1c1 0 1.8.8 1.8 1.8v.6H2.6v-2.57Z"
        />
        <path
          className="gfol-pf"
          d="M2.6 8.9h14.8c.55 0 .97.5.88 1.04l-.86 5.1a1.8 1.8 0 0 1-1.77 1.5H4.35c-.88 0-1.63-.63-1.77-1.5l-.86-5.1A.89.89 0 0 1 2.6 8.9Z"
        />
      </g>
      <g className="gfol gfol-open">
        <path
          className="gfol-pa"
          d="M2.6 5.4c0-1 .8-1.8 1.8-1.8h2.9c.48 0 .94.2 1.27.54l.86.9c.33.34.79.53 1.26.53h5.1c1 0 1.8.8 1.8 1.8v1.63H2.6V5.4Z"
        />
        <path
          className="gfol-pf"
          d="M3.1 8.9h14.4c.6 0 1.03.57.88 1.15l-1.13 4.3a1.8 1.8 0 0 1-1.74 1.34H5.1c-.83 0-1.55-.57-1.74-1.38l-1.13-4.26A.9.9 0 0 1 3.1 8.9Z"
        />
      </g>
    </svg>
  );
}

const GLYPH_PATHS = {
  home: (
    <path
      d="M3.4 9.3 10 3.6l6.6 5.7M5 8.4v7c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  doc: (
    <>
      <path
        d="M11.2 2.9H6.4c-.9 0-1.6.72-1.6 1.6v11c0 .88.7 1.6 1.6 1.6h7.2c.9 0 1.6-.72 1.6-1.6V6.7l-4-3.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M11 3.2v3.6h3.9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </>
  ),
  code: (
    <path
      d="M7.6 6.8 4.2 10l3.4 3.2M12.4 6.8 15.8 10l-3.4 3.2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  img: (
    <>
      <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="7.4" cy="8.2" r="1.3" fill="currentColor" />
      <path
        d="M4.5 14.6 8.7 10.4l3 3 1.9-1.9 2 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
};

export function KindGlyph({ kind }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
      {GLYPH_PATHS[kind] || GLYPH_PATHS.doc}
    </svg>
  );
}

export function SearchGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.4 9.4 12.6 12.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CrossGlyph() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
      <path d="M1.2 1.2 6.8 6.8M6.8 1.2 1.2 6.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PlusGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// 目录行的行内操作：改名 / 删除（hover 或选中才出，样式在 sidebar.css 的 .gacts）
export function RenameGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 10h2.5L9 5.5 7.5 4 3 8.5V10z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7 4l1 1 1.5-1.5L8 2 7 3z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function DeleteGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M3 4h6m-5 0V2.8c0-.44.36-.8.8-.8h2.4c.44 0 .8.36.8.8V4m-4 0v5.2c0 .44.36.8.8.8h2.4c.44 0 .8-.36.8-.8V4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// 「整棵树」的图标（侧边栏根行用）：堆叠的层，区别于文件夹——它是库本身，不是某一级目录
export function RootGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3.2 16.8 7 10 10.8 3.2 7 10 3.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M3.6 10.4 10 14l6.4-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.6 13.6 10 17.2l6.4-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
    </svg>
  );
}

// 行内「更多操作」的省略号（目录行与资源行共用，菜单在 Sidebar 里渲染）
export function MoreGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="7" r="1.2" />
      <circle cx="7" cy="7" r="1.2" />
      <circle cx="11" cy="7" r="1.2" />
    </svg>
  );
}

// 菜单里的「打开」：外指箭头 + 角标框，与 doc/code 族同线宽
export function OpenGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M5.5 2.5H2.6c-.6 0-1.1.5-1.1 1.1v7.8c0 .6.5 1.1 1.1 1.1h7.8c.6 0 1.1-.5 1.1-1.1V8.5M8.5 2H12v3.5M11.7 2.3 6.8 7.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 菜单里的「在文件管理器中打开」：文件夹 + 右下角外指箭头（「交出去给系统打开」）
export function RevealGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M1.4 4c0-.5.4-.9.9-.9h2.2c.24 0 .47.1.63.27l.46.46c.17.17.4.27.64.27h4.4c.5 0 .9.4.9.9v4.9c0 .5-.4.9-.9.9H2.3c-.5 0-.9-.4-.9-.9V4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 9.7h2.7V7M11.2 9.7 8.8 7.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 菜单里的「导入到该目录」：下方托盘 + 向下箭头（资源从外面进来）
export function ImportGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.8 9.4h8.4l-.7 3.05c-.07.3-.34.5-.65.5H4.15c-.31 0-.58-.2-.65-.5L2.8 9.4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M7 2.4v5.1M4.7 5.5 7 7.8l2.3-2.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 菜单里的「导出该目录」：下方托盘 + 向上箭头（资源交出去）
export function ExportGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.8 9.4h8.4l-.7 3.05c-.07.3-.34.5-.65.5H4.15c-.31 0-.58-.2-.65-.5L2.8 9.4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M7 7.9V2.8M4.7 4.8 7 2.5l2.3 2.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 菜单里的「新建文件夹」：文件夹（缩小让位）+ 右下角加号角标
export function NewFolderGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M1.3 3.9c0-.45.36-.8.8-.8h2.0c.2 0 .4.08.54.22l.46.46c.14.14.34.22.54.22h3.06c.44 0 .8.35.8.8v4.4c0 .44-.36.8-.8.8H2.1c-.44 0-.8-.36-.8-.8V3.9Z"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinejoin="round"
      />
      <path d="M10.6 9.6v2.8M9.2 11h2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// 菜单里的「新建资源」：文档（缩小让位）+ 右下角加号角标
export function NewFileGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3.1 1.8c-.44 0-.8.36-.8.8v8.8c0 .44.36.8.8.8h4.6c.44 0 .8-.36.8-.8V5.2L6.1 1.8H3.1Z"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinejoin="round"
      />
      <path d="M6.1 1.8v3.4h2.4" stroke="currentColor" strokeWidth="1.05" strokeLinejoin="round" />
      <path d="M10.6 9.6v2.8M9.2 11h2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// 头部「侧边栏设置」的齿轮（默认收起开关的入口）
export function GearGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 2.8v2.1M10 15.1v2.1M2.8 10h2.1M15.1 10h2.1M4.9 4.9l1.5 1.5M13.6 13.6l1.5 1.5M15.1 4.9l-1.5 1.5M6.4 13.6l-1.5 1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
