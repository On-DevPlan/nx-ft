// 色彩面板的侧边栏：本域的分组与资源树（实现在资产域的 side-tree.jsx，各领域共用）。
import { AssetSidebar } from '../../web/frontend/components/asset/side-tree.jsx';

export default function ColorSide() {
  return <AssetSidebar kind="color" />;
}
