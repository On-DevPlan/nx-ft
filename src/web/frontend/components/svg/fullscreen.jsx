// 整页预览（路由 `#/svg/asset/<分组>/<名字>/full`）：把一枚图标放大到整屏看。
//
// 存在的理由很具体：24px 的图标看不出「线帽有没有对齐、弧线拐点圆不圆」，
// 而这些问题恰恰是图标集看起来「齐不齐」的全部。所以这里给尺寸阶梯、
// 给 24pt 网格叠加、给明暗两种底色——用来验证 currentColor 那条规范真的成立。
import { useEffect, useState } from 'react';
import { useStore } from '../../store.jsx';
import { Copyable } from '../ui.jsx';
import { stamp } from './parts.jsx';
import { Icon } from './svg-inline.jsx';
import { useDetail, useNav } from './useSvg.js';

const SIZES = [24, 32, 48, 96, 192, 384];
const BACKDROPS = [
  { id: 'paper', label: '白底', cls: 'on-paper' },
  { id: 'soft', label: '浅灰', cls: 'on-soft' },
  { id: 'ink', label: '深色', cls: 'on-ink' },
];

export default function FullScreen({ group, name }) {
  const nav = useNav();
  const { boot } = useStore();
  const { data, err } = useDetail(group, name);
  const [size, setSize] = useState(192);
  const [bg, setBg] = useState('paper');
  const [grid, setGrid] = useState(false);

  const back = () => nav.asset(group, name);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // back 每次渲染都是新闭包，这里只需要「按 Esc 回上一级」这一个语义
  }, [group, name]);

  const style = data?.styles?.find((s) => s.name === data.activeStyle) || data?.styles?.[0];
  const svg = style?.svg || '';
  const backdrop = BACKDROPS.find((b) => b.id === bg) || BACKDROPS[0];
  const bin = boot?.app?.name || 'nx-ft';

  return (
    <div className="fullpage">
      <div className="fullpage-head">
        <div className="fullpage-title">
          <span className="mono">{group}/{name}</span>
          <span className="muted">{data?.label || ''}</span>
          {style ? <span className="tag">{style.name}</span> : null}
          {style?.audit?.issues?.length ? (
            <span className="tag">{style.audit.issues.length} 项待规范</span>
          ) : (
            <span className="tag">合规</span>
          )}
        </div>
        <div className="fullpage-acts">
          <div className="seg">
            {SIZES.map((s) => (
              <button key={s} className={'seg-btn' + (s === size ? ' active' : '')} onClick={() => setSize(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="seg">
            {BACKDROPS.map((b) => (
              <button key={b.id} className={'seg-btn' + (b.id === bg ? ' active' : '')} onClick={() => setBg(b.id)}>
                {b.label}
              </button>
            ))}
          </div>
          <button className={'btn ghost' + (grid ? '' : '')} onClick={() => setGrid((g) => !g)}>
            {grid ? '隐藏 24pt 网格' : '显示 24pt 网格'}
          </button>
          <Copyable className="btn ghost" text={svg} title="复制这枚图标的 SVG 源码">
            复制源码
          </Copyable>
          <button className="btn" onClick={back}>
            返回资源页 (Esc)
          </button>
        </div>
      </div>

      {err ? <div className="empty bad">接口调用失败：{err}</div> : null}

      <div className={'fullpage-stage ' + backdrop.cls}>
        <div
          className={'fullpage-canvas' + (grid ? ' with-grid' : '')}
          style={{ width: size, height: size, '--grid-step': size / 24 + 'px' }}
        >
          {svg ? (
            <Icon svg={svg} size={size} />
          ) : (
            <span className="muted">这个风格还没有 SVG 源码。用 {bin} svg put 写入，或在资源页里直接编辑。</span>
          )}
        </div>
      </div>

      <div className="fullpage-foot">
        <span className="muted">
          {style
            ? `${style.svg ? style.svg.length : 0} 字符 · 最近更新 ${stamp(style.updatedAt) || '—'} · 历史 ${style.historyCount}/5`
            : ''}
        </span>
        <span className="mono muted">
          {bin} svg cat {group} {name} --style {style?.name || 'default'} &gt; {name}.svg
        </span>
      </div>
    </div>
  );
}
