// ThemeRenderer：多平台注册表组件的实时渲染器（Catalog「注册表」区引用）。
//
// 输入 = registry 条目（archetype + theme.vars + props），零图片、零平台工具链：
// archetype css（中性结构原型）吃 theme.vars 的 nx tokens 词汇，在 Shadow DOM
// 里实时渲染。同一渲染器渲染任意平台——平台差异全部活在 theme 变量里。
//
// 变体派生：取 spec 的第一个 enum prop，其每个 value 生成一个实例
// （value === default 时用原型基类，否则追加修饰类——与 packs 的类契约同构）。
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import archetypeCss from '../archetype.css?inline';

function ShadowScope({ css, vars, children }) {
  const hostRef = useRef(null);
  const [root, setRoot] = useState(null);
  useEffect(() => {
    if (hostRef.current && !root) setRoot(hostRef.current.attachShadow({ mode: 'open' }));
  }, [root]);
  const varCss = Object.entries(vars || {})
    .map(([k, v]) => `${k}:${v};`)
    .join('');
  return (
    <div ref={hostRef} style={{ all: 'initial', display: 'block' }}>
      {root && createPortal(
        <>
          <style dangerouslySetInnerHTML={{ __html: `:host { ${varCss} }\n${css}` }} />
          {children}
        </>,
        root
      )}
    </div>
  );
}

// value → 修饰类：与默认值相同时用原型基类，否则 archetype + value
function clsFor(archetype, prop, value) {
  return value === prop.default ? archetype : `${archetype} ${value}`;
}

export default function ThemeRenderer({ item }) {
  const enumProps = Object.entries(item.props || {}).filter(([, p]) => p.type === 'enum');
  const [variantKey, variantProp] = enumProps[0] || [null, null];
  const sizeProp = enumProps[1]?.[1] || null;

  const instances = variantProp
    ? variantProp.values.map((v) => ({
        label: `${variantKey}: ${v || '(default)'}`,
        cls: clsFor(item.archetype, variantProp, v),
      }))
    : [{ label: 'default', cls: item.archetype }];

  const disabledCls = clsFor(item.archetype, variantProp || {}, variantProp?.default ?? '');

  return (
    <div className="stack">
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="colhead">
          <span>结构示意 · HTML 近似（非平台像素）</span>
          <span className="muted tag">archetype: {item.archetype}</span>
        </div>
        <div className="sheet-b" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <ShadowScope css={archetypeCss} vars={item.theme}>
            {instances.map((ins) => (
              <span key={ins.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: item.theme?.['--font'] || 'inherit' }}>
                <button className={ins.cls}>{item.title || item.id}</button>
                <span className="muted" style={{ fontSize: 11 }}>{ins.label}</span>
              </span>
            ))}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: item.theme?.['--font'] || 'inherit' }}>
              <button className={disabledCls} disabled>禁用态</button>
              <span className="muted" style={{ fontSize: 11 }}>disabled: true</span>
            </span>
          </ShadowScope>
        </div>
      </div>

      {sizeProp && (
        <div className="sheet">
          <div className="sheet-h"><span>size · {sizeProp.values.join(' / ')}</span></div>
          <div className="sheet-b" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <ShadowScope css={archetypeCss} vars={item.theme}>
              {sizeProp.values.map((s) => (
                <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: item.theme?.['--font'] || 'inherit' }}>
                  <button className={`${clsFor(item.archetype, variantProp || {}, variantProp?.default ?? '')} ${s === 'sm' || s === 'small' ? 'small' : ''}`}>
                    {item.title || item.id}
                  </button>
                  <span className="muted" style={{ fontSize: 11 }}>{s}</span>
                </span>
              ))}
            </ShadowScope>
          </div>
        </div>
      )}
    </div>
  );
}
