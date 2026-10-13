// LOGO 生成业务：输入校验 → 写全套文件（画廊或指定目录）→ 登记历史。
//
// 两条典型路径：
//   logo gen xx                        → 写进用户数据区的画廊（带时间戳，不覆盖）
//   logo gen xx --out D:/old/public    → 直接补进旧项目目录（同名文件存在时先返回
//                                        conflict，需 --force 才覆盖——不静默摧毁手改过的图）
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { badInput } from '../errors/index.js';
import { logosDirFromEnv } from '../paths.js';
import { readJsonSafe, writeJsonAtomic } from '../assets/storage.js';
import { generateAll } from './gen.js';
import { DEFAULT_SCHEME, listSchemes, resolveScheme } from './schemes.js';

export const HISTORY_KEEP = 50;

// 全套产物文件名（与 generateAll 保持一致；冲突检测用）
export const OUTPUT_FILES = [
  'logo.svg',
  'logo-rounded.svg',
  'logo.png',
  'logo-rounded.png',
  'favicon-16.png',
  'favicon-32.png',
  'favicon-48.png',
  'favicon.ico',
];

const registryPath = () => join(logosDirFromEnv(), 'registry.json');

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
}

export function validateLetters(input) {
  const s = String(input ?? '').trim();
  if (!/^[A-Za-z0-9._-]{1,5}$/.test(s)) {
    throw badInput(
      `字母需 1~5 位（字母 / 数字 / - _ .），收到: ${input || '(空)'}。PNG 点阵字模只适合 1~5 个字符。`
    );
  }
  return s;
}

function validateSize(input) {
  if (input === undefined || input === null || input === '') return 512;
  const n = Number(input);
  if (!Number.isFinite(n) || n < 16 || n > 2048) throw badInput(`尺寸需在 16~2048 之间，收到: ${input}`);
  return Math.round(n);
}

export function listHistory() {
  const raw = readJsonSafe(registryPath());
  return {
    dir: logosDirFromEnv(),
    schemes: listSchemes(),
    defaultScheme: DEFAULT_SCHEME,
    records: (raw && raw.records) || [],
  };
}

export function generate({ letters, scheme, bg, fg, out, size, force }) {
  const chars = validateLetters(letters);
  const theme = resolveScheme(scheme, { bg, fg });
  const px = validateSize(size);
  const gallery = !out;
  const target = gallery
    ? join(logosDirFromEnv(), `${chars}-${theme.key}-${stamp()}`)
    : resolve(String(out));

  if (!gallery) {
    const existing = OUTPUT_FILES.filter((f) => existsSync(join(target, f)));
    if (existing.length && !force) {
      return {
        status: 'conflict',
        dir: target,
        existing,
        reason: '目标目录已有同名文件，加 --force 覆盖（它们可能是手工调整过的图）',
      };
    }
  }

  const { note, files } = generateAll(target, chars, theme, { size: px });
  const record = {
    id: `${stamp()}-${chars}`,
    letters: chars,
    scheme: theme.key,
    schemeName: theme.name,
    bg: theme.bg,
    fg: theme.fg,
    size: px,
    gallery,
    dir: target,
    files,
    at: new Date().toISOString(),
  };
  const raw = readJsonSafe(registryPath()) || { version: 1, records: [] };
  writeJsonAtomic(registryPath(), {
    version: 1,
    records: [record, ...(raw.records || [])].slice(0, HISTORY_KEEP),
  });

  return { status: 'ok', note, ...record };
}
