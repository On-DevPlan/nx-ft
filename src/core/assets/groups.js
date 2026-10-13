// 分组业务：列出全库树、建分组、删分组。
// 失败 throw；「已存在」这类调用方可决策的返回 {status:'skipped'/'blocked'}。
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { badInput, notFound } from '../errors/index.js';
import { parseGroupPath, normalizeTags } from './constants.js';
import * as st from './storage.js';

export function labelOf(label, fallback) {
  const v = String(label ?? '').trim();
  if (!v) return fallback;
  if (v.length > 60) throw badInput('标签最长 60 字符');
  return v;
}

// 全库树：groups: [{ path, label, assets: [...] }]
//
// kindFilter 给出时只列属于该类型的资源（资源清单里记有 kind）——
// 同一分组下 html 与 svg 资源各自独立，两个面板拿到的是各自的树。
//
// 筛选语义（CLI --search/--tags 与面板筛选共用同一套，不许两端分叉）：
//   tags   多选为 AND——资源必须包含全部选中标签（100+ 资源用「逐层收窄」找得快）
//   search 大小写不敏感子串，匹配 名称 / 展示名 / 分组路径 / 标签 / 风格名
// availableTags 基于「该 kind 的全部资源」统计（不受筛选影响），筛选时标签云不跳变。
export function listTree(kindFilter, { search = '', tags = [] } = {}) {
  const scanned = st.scanGroups();
  const wantTags = normalizeTags(tags);
  const q = String(search || '').trim().toLowerCase();
  const tagCounts = new Map();
  let kindTotal = 0;

  const groups = scanned
    .map(({ groupPath, manifest }) => {
      const assets = Object.values(manifest.assets).filter((a) => !kindFilter || a.kind === kindFilter);
      kindTotal += assets.length;
      for (const a of assets) {
        for (const t of a.tags || []) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
      return {
        path: groupPath,
        label: manifest.group.label || manifest.group.name,
        assets: assets
          .filter((a) => {
            const at = a.tags || [];
            if (wantTags.length && !wantTags.every((t) => at.includes(t))) return false;
            if (!q) return true;
            const hay = [a.name, a.label || '', groupPath, ...at, ...Object.keys(a.styles || {})]
              .join(' ')
              .toLowerCase();
            return hay.includes(q);
          })
          .map((a) => ({
            name: a.name,
            label: a.label || a.name,
            styles: a.styleCount ?? Object.keys(a.styles || {}).length,
            activeStyle: a.activeStyle || null,
            tags: a.tags || [],
            updatedAt: a.updatedAt || null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
    })
    .filter((g) => g.assets.length);

  const availableTags = [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    root: st.groupsRoot(),
    count: { groups: groups.length, assets: groups.reduce((n, g) => n + g.assets.length, 0) },
    total: { assets: kindTotal },
    filter: { search: String(search || ''), tags: wantTags },
    availableTags,
    groups,
  };
}

export function addGroup({ group, label }) {
  const groupPath = parseGroupPath(group);
  if (st.loadGroup(groupPath)) return { status: 'skipped', path: groupPath, reason: '已存在' };
  const manifest = st.newManifest(groupPath, labelOf(label, undefined));
  st.saveGroup(groupPath, manifest);
  return { status: 'ok', path: groupPath, label: manifest.group.label };
}

export function removeGroup({ group, force }) {
  const groupPath = parseGroupPath(group);
  const manifest = st.loadGroup(groupPath);
  if (!manifest) throw notFound(`分组不存在: ${groupPath}`);
  const assetCount = Object.keys(manifest.assets).length;
  const nested = listDirs(st.groupDir(groupPath)).filter((n) => n !== st.ASSETS_SUBDIR).length;
  if ((assetCount || nested) && !force) {
    return {
      status: 'blocked',
      path: groupPath,
      assets: assetCount,
      groups: nested,
      reason: '分组非空，加 --force 连同内容一起删除',
    };
  }
  rmSync(st.groupDir(groupPath), { recursive: true, force: true });
  // 顺带清掉被删空的父目录链。判定「空壳」必须是真容器：既没有子目录、
  // 也没有自己的 group.json——只看子目录会误删「资源还没落盘成文件」的父分组
  // （它的 assets/ 目录尚未创建，但 group.json 里清清楚楚有一堆资源）。
  const segs = groupPath.split('/');
  for (let i = segs.length - 1; i >= 1; i--) {
    const p = join(st.groupsRoot(), ...segs.slice(0, i));
    const isEmptyShell = existsSync(p) && listDirs(p).length === 0 && !existsSync(join(p, st.GROUP_FILE));
    if (isEmptyShell) rmSync(p, { recursive: true, force: true });
  }
  return { status: 'ok', path: groupPath, removed: { assets: assetCount, groups: nested } };
}

function listDirs(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((n) => {
    try {
      return statSync(join(dir, n)).isDirectory();
    } catch {
      return false;
    }
  });
}
