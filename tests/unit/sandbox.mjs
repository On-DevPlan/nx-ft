// 每个用例独立的临时数据目录。**测试绝不碰用户的真实 ~/.nx-ft**：
// NX_FT_DATA 是存储层唯一的根，指到 mkdtemp 出来的目录就完全隔离。
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function sandbox() {
  process.env.NX_FT_DATA = mkdtempSync(join(tmpdir(), 'nx-ft-assets-'));
}
