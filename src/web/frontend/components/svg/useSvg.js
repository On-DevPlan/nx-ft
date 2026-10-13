// SVG 看板的数据层：路由导航 + 看板数据 + 资源详情。
//
// 三个 hook 各自只做一件事：拉数据 / 报错 / 重载。页面组件拿到 data 之后
// 只负责画，不在组件里夹请求——否则「切换筛选项触发几次请求」这类问题
// 会散落在每个页面里，没人说得清。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';

const enc = encodeURIComponent;
// 分组路径逐段编码、斜杠保留 —— 与 components/asset/index.jsx 的 encPath 同一口径，
// 这样 `#/svg/edit/ui/nav/search` 既可读，解析时又能靠「名字恒为最后一段」还原分组。
const encPath = (p) =>
  String(p ?? '')
    .split('/')
    .filter(Boolean)
    .map(enc)
    .join('/');

function go(hash) {
  if (location.hash !== hash) location.hash = hash;
}

// 导航：URL 词汇与资产域一致（见 modules/svg/view.jsx 顶部的路由表）。
// 返回具名方法而不是 `nav('edit', …)` 这种字符串分派——调用点读起来就是「去哪一层」。
export function useNav() {
  return useMemo(
    () => ({
      board: () => go('#/svg'),
      group: (path) => go(`#/svg/dir/${encPath(path)}`),
      asset: (group, name) => go(`#/svg/edit/${encPath(group)}/${enc(name)}`),
      full: (group, name) => go(`#/svg/edit/${encPath(group)}/${enc(name)}/full`),
    }),
    []
  );
}

function qs(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    q.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = q.toString();
  return s ? '?' + s : '';
}

// 看板：整库图标一次取齐（后端 buildBoard 已经复用 listTree 的同一套筛选）。
export function useBoard({ search = '', tags = [] } = {}) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);
  const key = JSON.stringify([search, tags]);

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const d = await api('/api/svg/board' + qs({ search, tags }));
      setData(d);
      setErr('');
      return d;
    } catch (e) {
      setErr(String((e && e.message) || e));
      return null;
    } finally {
      setBusy(false);
    }
    // key 已经把 search/tags 收敛成一个稳定字符串，避免数组每次渲染都算作新依赖
  }, [key]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, err, busy, reload };
}

// 资源详情：全部风格各自的源码 + 审计（资源页多风格并排对比用）。
export function useDetail(group, name) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);

  const reload = useCallback(async () => {
    if (!group || !name) {
      setData(null);
      setBusy(false);
      return null;
    }
    setBusy(true);
    try {
      const d = await api('/api/svg/detail' + qs({ group, name }));
      setData(d);
      setErr('');
      return d;
    } catch (e) {
      setErr(String((e && e.message) || e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [group, name]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, err, busy, reload };
}

// 搜索防抖：输入框即时回显，查询等 250ms（库大了之后每键一次请求会很吵）。
export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
