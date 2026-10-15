// HTML 面板的侧边栏：本域的分组目录树（实现在资产域的 side-tree.jsx，两个领域共用）。
import { AssetSidebar } from '../../web/frontend/components/asset/side-tree.jsx';

export default function HtmlSide() {
  return <AssetSidebar kind="html" />;
}
