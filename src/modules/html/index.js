// HTML 渲染域：CodePen 式的本机 HTML/CSS/JS 资源管理。
// 共用 CRUD 由 core/assets/actions.js 按 kind 生成；本域专属能力（zip 批量导入导出）
// 在 core/assets/set-actions.js —— 与 svg 的 svg.import / svg.export 同构，
// 语义按各自的约定走（html 一资源一目录三件套）。
import { makeModule } from '../../core/assets/actions.js';
import { setActions } from '../../core/assets/set-actions.js';

export default makeModule('html', 10, setActions('html'));
