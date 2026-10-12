// registry/ 目录形状一致性：多平台注册表的「漏登记 / 写错形状」当场红。
//
// registry/<platform>/<id>/spec.json 是面板「注册表 · 多平台」区的数据源，
// theme 走两级合并（平台级 registry/<platform>/theme.json + 组件级覆盖）。
// spec 字段写错形状（enum 无 values、theme 值非字符串）会让 ThemeRenderer
// 静默渲染出空壳——这里把它们变成响亮失败。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REGISTRY_DIR = join(ROOT, 'registry');

function* registryEntries() {
  for (const p of readdirSync(REGISTRY_DIR, { withFileTypes: true })) {
    if (!p.isDirectory()) continue;
    for (const c of readdirSync(join(REGISTRY_DIR, p.name), { withFileTypes: true })) {
      if (!c.isDirectory()) continue;
      const specPath = join(REGISTRY_DIR, p.name, c.name, 'spec.json');
      if (existsSync(specPath)) {
        yield { platform: p.name, id: c.name, specPath };
      }
    }
  }
}

function themeVars(platform) {
  // 平台级 theme（组件级覆盖合并前的公共底座）
  const p = join(REGISTRY_DIR, platform, 'theme.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).vars || {} : {};
}

test('registry 每个 spec 的 id/platform 与目录一致（目录是寻址真相）', () => {
  const bad = [];
  for (const { platform, id, specPath } of registryEntries()) {
    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    if (spec.id !== id) bad.push(`${platform}/${id}: spec.id=${spec.id}`);
    if (spec.platform && spec.platform !== platform) bad.push(`${platform}/${id}: spec.platform=${spec.platform}`);
  }
  assert.deepEqual(bad, [], `spec 与目录漂移:\n${bad.join('\n')}`);
});

test('registry enum prop 必须带非空 values 与 default（playground 控件条的数据源）', () => {
  const bad = [];
  for (const { platform, id } of registryEntries()) {
    const spec = JSON.parse(readFileSync(join(REGISTRY_DIR, platform, id, 'spec.json'), 'utf8'));
    for (const [name, prop] of Object.entries(spec.props || {})) {
      if (prop.type !== 'enum') continue;
      if (!Array.isArray(prop.values) || !prop.values.length) {
        bad.push(`${platform}/${id}.${name}: enum 缺 values`);
      } else if (!prop.values.includes(prop.default)) {
        bad.push(`${platform}/${id}.${name}: default ${JSON.stringify(prop.default)} 不在 values 里`);
      }
    }
  }
  assert.deepEqual(bad, [], `enum prop 形状错误:\n${bad.join('\n')}`);
});

test('registry theme（合并后）值全为字符串且覆盖预览所需 tokens', () => {
  const bad = [];
  for (const { platform, id } of registryEntries()) {
    const vars = { ...themeVars(platform) };
    const ownPath = join(REGISTRY_DIR, platform, id, 'theme.json');
    if (existsSync(ownPath)) Object.assign(vars, JSON.parse(readFileSync(ownPath, 'utf8')).vars || {});
    for (const [k, v] of Object.entries(vars)) {
      if (typeof v !== 'string') bad.push(`${platform}/${id}: theme.${k} = ${JSON.stringify(v)}（非字符串）`);
    }
    if (!vars['--ink'] || !vars['--paper']) {
      bad.push(`${platform}/${id}: theme 缺 --ink / --paper（ThemeRenderer 无主色可用）`);
    }
  }
  assert.deepEqual(bad, [], `theme 形状错误:\n${bad.join('\n')}`);
});

test('registry preview.type=flutter-web 的组件必须有 Dart dispatch 支持', () => {
  // 单 playground：所有 flutter-web 组件共用同一个 Dart dispatch（main.dart）。
  // registry 注册了 Dart 不认识的 id，面板选中后只会看到 Placeholder——
  // 这里对齐两侧（main.dart 的 dispatch switch 是唯一真相）。
  const dart = readFileSync(join(ROOT, 'tools', 'flutter-showcase', 'lib', 'main.dart'), 'utf8');
  const bad = [];
  for (const { platform, id, specPath } of registryEntries()) {
    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    if (spec.preview?.type !== 'flutter-web') continue;
    if (!new RegExp(`'${id}' =>`).test(dart)) {
      bad.push(`${platform}/${id}: main.dart dispatch 不认识 '${id}'`);
    }
  }
  assert.deepEqual(bad, [], `registry 与 Dart showcase 漂移:\n${bad.join('\n')}`);
});
