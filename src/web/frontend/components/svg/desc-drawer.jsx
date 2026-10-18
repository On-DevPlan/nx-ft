// 描述抽屉：主描述 + **全部风格**的描述一次填完，渲染在通用 Drawer 壳里。
// 演变史：最早表单给所有风格各渲染一行 → 收窄成只出当前一格（inline 时代，
// 嫌「未选中的混进来」）→ 现在换抽屉集中编辑：风格一多，逐格切换再逐次保存
// 太磨人，一屏摆开、一次保存。数据与保存动作仍由 Detail 页传入，本件只编排表单。
// 排版：主描述 / 风格描述两段（.dsec，段间 1px 分隔）；风格行 = 图标格 + 名字 +
// 输入框，让「改的是哪套」一眼可辨，不再是一列无身份的输入框。
import { useState } from 'react';
import { Btn } from '../btn/index.jsx';
import { Drawer } from '../drawer/index.jsx';
import { Icon, IconGhost } from './svg-inline.jsx';

export function DescDrawer({ group, name, desc = '', styles = [], activeStyle = '', busy, onClose, onSave }) {
  // 挂载即播种（调用方条件挂载，重开抽屉 = 重新播种）：保存途中 reload 会换
  // props，绝不能跟着重置——否则先保存的风格会清掉还没轮到的输入。
  const [mainText, setMainText] = useState(desc || '');
  const [styleText, setStyleText] = useState(() =>
    Object.fromEntries(styles.map((s) => [s.name, s.desc || '']))
  );

  return (
    <Drawer
      title="编辑描述"
      subtitle={group ? `${group} / ${name}` : ''}
      onClose={onClose}
      width={620}
      testId="desc-drawer"
      footer={
        <>
          <span className="drawer-foot-hint">
            保存后 <code className="mono">svg tree --search</code> 能按描述召回
          </span>
          <Btn size="sm" variant="primary" busy={busy} onClick={() => onSave(mainText, styleText)} testId="desc-save">
            保存全部
          </Btn>
          <Btn size="sm" variant="secondary" disabled={busy} onClick={onClose}>
            取消
          </Btn>
        </>
      }
    >
      <div className="desc-edit" data-testid="desc-edit">
        <section className="desc-sec">
          <div className="desc-sec-head">
            <span className="desc-sec-title">主描述</span>
            <span className="desc-sec-hint">这个资源是什么场景，一句话</span>
          </div>
          <div className="desc-sec-body">
            <input
              className="desc-input"
              spellCheck="false"
              placeholder="如：一只骑车送外卖的鹈鹕，用于首页加载动画"
              value={mainText}
              disabled={busy}
              onChange={(e) => setMainText(e.target.value)}
              data-testid="desc-main-input"
            />
          </div>
        </section>
        <section className="desc-sec">
          <div className="desc-sec-head">
            <span className="desc-sec-title">风格描述</span>
            {styles.length ? <span className="tag">{styles.length}</span> : null}
            <span className="desc-sec-hint">这一套与别的差在哪</span>
          </div>
          {styles.length ? (
            styles.map((s) => (
              <label key={s.name} className="style-desc-row" title={s.name}>
                <span className="style-desc-art">
                  {s.svg ? <Icon svg={s.svg} size={15} /> : <IconGhost size={15} />}
                </span>
                <span className="style-desc-name">
                  <span className="mono">{s.name}</span>
                  {s.name === activeStyle ? <span className="tag">当前</span> : null}
                </span>
                <input
                  className="desc-input"
                  spellCheck="false"
                  placeholder="如：整体更圆润，适合深色底"
                  value={styleText[s.name] ?? ''}
                  disabled={busy}
                  onChange={(e) => setStyleText((prev) => ({ ...prev, [s.name]: e.target.value }))}
                  data-testid={`desc-style-input-${s.name}`}
                />
              </label>
            ))
          ) : (
            <div className="style-desc-empty muted f11">还没有风格</div>
          )}
        </section>
      </div>
    </Drawer>
  );
}
